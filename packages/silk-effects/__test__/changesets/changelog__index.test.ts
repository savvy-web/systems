import { describe, expect, it, vi } from "vitest";

import changelogFunctions, { makeChangelogFunctions } from "../../src/changesets/changelog/index.js";

// Mock the GitHub API to avoid real network calls
vi.mock("@changesets/get-github-info", () => ({
	getCommitInfo: vi.fn().mockResolvedValue({
		commit: {
			sha: "abc1234567890",
			url: "https://github.com/owner/repo/commit/abc1234567890",
			markdownLink: "[`abc1234`](https://github.com/owner/repo/commit/abc1234567890)",
		},
		author: {
			login: "testuser",
			url: "https://github.com/testuser",
			markdownLink: "[@testuser](https://github.com/testuser)",
		},
		pull: {
			number: 99,
			url: "https://github.com/owner/repo/pull/99",
			markdownLink: "[#99](https://github.com/owner/repo/pull/99)",
		},
	}),
}));

const OPTIONS = { repo: "owner/repo" };

describe("changelog/index (export boundary)", () => {
	it("exports getReleaseLine as an async function", () => {
		expect(typeof changelogFunctions.getReleaseLine).toBe("function");
	});

	it("exports getDependencyReleaseLine as an async function", () => {
		expect(typeof changelogFunctions.getDependencyReleaseLine).toBe("function");
	});

	it("getReleaseLine returns a formatted string", async () => {
		const result = await changelogFunctions.getReleaseLine(
			{
				id: "test-1",
				summary: "feat: add new feature",
				releases: [{ name: "test-pkg", type: "minor" }],
				commit: "abc1234567890",
			},
			"minor",
			OPTIONS,
		);
		expect(typeof result).toBe("string");
		expect(result).toContain("add new feature");
	});

	it("getDependencyReleaseLine returns a formatted string", async () => {
		const result = await changelogFunctions.getDependencyReleaseLine(
			[
				{
					id: "dep-1",
					summary: "bump deps",
					releases: [],
					commit: "abc1234567890",
				},
			],
			[
				{
					name: "some-dep",
					type: "patch",
					oldVersion: "1.0.0",
					newVersion: "1.0.1",
					changesets: [],
					packageJson: { name: "some-dep", version: "1.0.1" },
					dir: "/packages/some-dep",
				},
			],
			OPTIONS,
		);
		expect(typeof result).toBe("string");
		expect(result).toContain("some-dep");
	});

	it("getDependencyReleaseLine returns empty for no deps", async () => {
		const result = await changelogFunctions.getDependencyReleaseLine([], [], OPTIONS);
		expect(result).toBe("");
	});

	it("getReleaseLine rejects with null options", async () => {
		await expect(
			changelogFunctions.getReleaseLine(
				{
					id: "null-opts",
					summary: "test",
					releases: [{ name: "test-pkg", type: "patch" }],
				},
				"patch",
				null,
			),
		).rejects.toThrow();
	});

	it("getReleaseLine rejects with invalid repo format", async () => {
		await expect(
			changelogFunctions.getReleaseLine(
				{
					id: "bad-repo",
					summary: "test",
					releases: [{ name: "test-pkg", type: "patch" }],
					commit: "abc1234567890",
				},
				"patch",
				{ repo: "invalid-format" },
			),
		).rejects.toThrow();
	});

	it("getDependencyReleaseLine rejects with null options", async () => {
		await expect(
			changelogFunctions.getDependencyReleaseLine(
				[{ id: "dep-null", summary: "bump", releases: [], commit: "abc1234567890" }],
				[
					{
						name: "dep",
						type: "patch",
						oldVersion: "1.0.0",
						newVersion: "1.0.1",
						changesets: [],
						packageJson: { name: "dep", version: "1.0.1" },
						dir: "/packages/dep",
					},
				],
				null,
			),
		).rejects.toThrow();
	});

	describe("makeChangelogFunctions", () => {
		it("builds an independent ChangelogFunctions object each call", () => {
			const a = makeChangelogFunctions();
			const b = makeChangelogFunctions({ logMode: "silent" });
			expect(a).not.toBe(b);
			expect(typeof b.getReleaseLine).toBe("function");
			expect(typeof b.getDependencyReleaseLine).toBe("function");
		});

		it("the default export is the no-option build: a failed lookup warns plainly on stderr", async () => {
			const { getCommitInfo } = await import("@changesets/get-github-info");
			vi.mocked(getCommitInfo).mockRejectedValueOnce(new Error("boom"));
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const result = await changelogFunctions.getReleaseLine(
					{
						id: "default-mode",
						summary: "feat: default mode",
						releases: [{ name: "test-pkg", type: "minor" }],
						commit: "abc1234567890",
					},
					"minor",
					OPTIONS,
				);
				expect(result).toContain("default mode");
				expect(warn).toHaveBeenCalledTimes(1);
				expect(warn.mock.calls[0]?.[0]).toBe("Could not fetch GitHub info for commit:");
				expect(warn.mock.calls[0]?.[0]).not.toMatch(/^::warning::/);
			} finally {
				warn.mockRestore();
			}
		});

		it("provides the requested log mode to the program", async () => {
			// A rejected GitHub lookup is the one path that warns: it must be
			// discarded in silent mode and annotated in github mode.
			const { getCommitInfo } = await import("@changesets/get-github-info");
			const mocked = vi.mocked(getCommitInfo);
			mocked.mockRejectedValueOnce(new Error("boom"));
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				await makeChangelogFunctions({ logMode: "silent" }).getReleaseLine(
					{
						id: "silent",
						summary: "fix: silent",
						releases: [{ name: "test-pkg", type: "patch" }],
						commit: "abc1234567890",
					},
					"patch",
					OPTIONS,
				);
				expect(warn).not.toHaveBeenCalled();

				mocked.mockRejectedValueOnce(new Error("boom"));
				await makeChangelogFunctions({ logMode: "github" }).getReleaseLine(
					{
						id: "github",
						summary: "fix: github",
						releases: [{ name: "test-pkg", type: "patch" }],
						commit: "abc1234567890",
					},
					"patch",
					OPTIONS,
				);
				expect(warn).toHaveBeenCalledTimes(1);
				expect(warn.mock.calls[0]?.[0]).toMatch(/^::warning::Could not fetch GitHub info for commit:/);
			} finally {
				warn.mockRestore();
			}
		});
	});
});

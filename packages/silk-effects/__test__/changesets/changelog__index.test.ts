import { describe, expect, it, vi } from "vitest";

import changelogFunctions from "../../src/changesets/changelog/index.js";

// Mock the GitHub API to avoid real network calls
vi.mock("@changesets/get-github-info", () => ({
	getInfo: vi.fn().mockResolvedValue({
		user: "testuser",
		pull: 99,
		links: {
			commit: "[`abc1234`](https://github.com/owner/repo/commit/abc1234567890)",
			pull: "https://github.com/owner/repo/pull/99",
			user: "https://github.com/testuser",
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
});

import { afterEach, describe, expect, it, vi } from "vitest";
import changelogFunctions from "../src/index.js";

describe("@savvy-web/changelog", () => {
	it("default-exports a ChangelogFunctions object built by the silk-effects factory", () => {
		expect(typeof changelogFunctions.getReleaseLine).toBe("function");
		expect(typeof changelogFunctions.getDependencyReleaseLine).toBe("function");
	});

	it("runs the silk-effects pipeline (an empty dependency release line is empty)", async () => {
		expect(await changelogFunctions.getDependencyReleaseLine([], [], { repo: "owner/repo" })).toBe("");
	});

	describe("logMode() — the host adapter reads process.env, the engine never does", () => {
		// Each branch re-imports the module under a stubbed environment and
		// observes the mode through the one path that warns: a rejected GitHub
		// lookup. The lookup is mocked so no network (or `.env`) is touched.
		afterEach(() => {
			vi.unstubAllEnvs();
			vi.resetModules();
			vi.doUnmock("@changesets/get-github-info");
		});

		const warnUnderEnv = async (env: Record<string, string | undefined>): Promise<ReadonlyArray<unknown>> => {
			vi.resetModules();
			for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
			vi.doMock("@changesets/get-github-info", () => ({
				getCommitInfo: vi.fn().mockRejectedValue(new Error("boom")),
			}));
			const { default: fns } = await import("../src/index.js");
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const line = await fns.getReleaseLine(
					{ id: "x", summary: "fix: thing", releases: [{ name: "pkg", type: "patch" }], commit: "0000000000000000" },
					"patch",
					{ repo: "owner/repo" },
				);
				expect(line).toContain("thing");
				return warn.mock.calls.map((call) => call[0]);
			} finally {
				warn.mockRestore();
			}
		};

		it("VITEST set → silent", async () => {
			expect(await warnUnderEnv({ VITEST: "true", GITHUB_ACTIONS: "true" })).toEqual([]);
		});

		it("GITHUB_ACTIONS=true (no VITEST) → github annotation", async () => {
			const calls = await warnUnderEnv({ VITEST: undefined, GITHUB_ACTIONS: "true" });
			expect(calls).toHaveLength(1);
			expect(calls[0]).toMatch(/^::warning::Could not fetch GitHub info for commit:/);
		});

		it("neither → stderr", async () => {
			const calls = await warnUnderEnv({ VITEST: undefined, GITHUB_ACTIONS: undefined });
			expect(calls).toEqual(["Could not fetch GitHub info for commit:"]);
		});
	});
});

import { describe, expect, it } from "vitest";

/**
 * Structural shape tests for commitlint config-integration shims.
 *
 * Each test asserts the ORIGINAL module shape from @savvy-web/commitlint so that
 * a consumer config that referenced the old @savvy-web/commitlint/... subpath
 * works unchanged against @savvy-web/silk/commitlint/....
 */

describe("commitlint shims", () => {
	describe("root (@savvy-web/silk/commitlint)", () => {
		it("exports CommitlintConfig class with static silk() method", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(mod.CommitlintConfig).toBeDefined();
			expect(typeof mod.CommitlintConfig.silk).toBe("function");
		});

		it("default export is CommitlintConfig", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(mod.default).toBe(mod.CommitlintConfig);
		});

		it("CommitlintConfig.silk() returns a valid commitlint config object", async () => {
			const mod = await import("../src/commitlint/index.js");
			const config = mod.CommitlintConfig.silk();
			expect(config).toBeTypeOf("object");
			expect(Array.isArray(config.extends)).toBe(true);
			expect(config.rules).toBeTypeOf("object");
		});

		it("exports COMMIT_TYPES array", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(Array.isArray(mod.COMMIT_TYPES)).toBe(true);
			expect(mod.COMMIT_TYPES.length).toBeGreaterThan(0);
		});

		it("exports COMMIT_TYPE_DEFINITIONS array", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(Array.isArray(mod.COMMIT_TYPE_DEFINITIONS)).toBe(true);
			expect((mod.COMMIT_TYPE_DEFINITIONS as unknown[]).length).toBeGreaterThan(0);
		});

		it("exports TDD_SCOPE_PATTERN as a RegExp", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(mod.TDD_SCOPE_PATTERN).toBeInstanceOf(RegExp);
		});

		it("exports TDD_STATES as an array", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(Array.isArray(mod.TDD_STATES)).toBe(true);
		});
	});
});

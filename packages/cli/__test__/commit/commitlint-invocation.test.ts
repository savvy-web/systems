import { describe, expect, it } from "vitest";
import { buildCommitlintInvocation } from "../../src/commands/commit/commitlint-invocation.js";

describe("buildCommitlintInvocation", () => {
	describe("--last tail (post-commit-verify)", () => {
		it("uses pnpm exec for pnpm projects", () => {
			expect(buildCommitlintInvocation("pnpm", "/r/cl.ts", ["--last"])).toEqual({
				command: "pnpm",
				args: ["exec", "commitlint", "--config", "/r/cl.ts", "--last"],
			});
		});

		it("uses yarn exec for yarn projects", () => {
			expect(buildCommitlintInvocation("yarn", "/r/cl.ts", ["--last"])).toEqual({
				command: "yarn",
				args: ["exec", "commitlint", "--config", "/r/cl.ts", "--last"],
			});
		});

		it("uses bunx for bun projects", () => {
			expect(buildCommitlintInvocation("bun", "/r/cl.ts", ["--last"])).toEqual({
				command: "bunx",
				args: ["commitlint", "--config", "/r/cl.ts", "--last"],
			});
		});

		it("uses npx --no -- for npm projects", () => {
			expect(buildCommitlintInvocation("npm", "/r/cl.ts", ["--last"])).toEqual({
				command: "npx",
				args: ["--no", "--", "commitlint", "--config", "/r/cl.ts", "--last"],
			});
		});

		it("omits --config when configPath is null", () => {
			expect(buildCommitlintInvocation("pnpm", null, ["--last"])).toEqual({
				command: "pnpm",
				args: ["exec", "commitlint", "--last"],
			});
		});
	});

	describe("--edit <file> tail (commit lint)", () => {
		it("uses pnpm exec for pnpm projects", () => {
			expect(buildCommitlintInvocation("pnpm", "/r/cl.ts", ["--edit", "/tmp/MSG"])).toEqual({
				command: "pnpm",
				args: ["exec", "commitlint", "--config", "/r/cl.ts", "--edit", "/tmp/MSG"],
			});
		});

		it("uses yarn exec for yarn projects", () => {
			expect(buildCommitlintInvocation("yarn", "/r/cl.ts", ["--edit", "/tmp/MSG"])).toEqual({
				command: "yarn",
				args: ["exec", "commitlint", "--config", "/r/cl.ts", "--edit", "/tmp/MSG"],
			});
		});

		it("uses bunx for bun projects", () => {
			expect(buildCommitlintInvocation("bun", "/r/cl.ts", ["--edit", "/tmp/MSG"])).toEqual({
				command: "bunx",
				args: ["commitlint", "--config", "/r/cl.ts", "--edit", "/tmp/MSG"],
			});
		});

		it("uses npx --no -- for npm projects", () => {
			expect(buildCommitlintInvocation("npm", "/r/cl.ts", ["--edit", "/tmp/MSG"])).toEqual({
				command: "npx",
				args: ["--no", "--", "commitlint", "--config", "/r/cl.ts", "--edit", "/tmp/MSG"],
			});
		});

		it("omits --config when configPath is null", () => {
			expect(buildCommitlintInvocation("pnpm", null, ["--edit", "/tmp/MSG"])).toEqual({
				command: "pnpm",
				args: ["exec", "commitlint", "--edit", "/tmp/MSG"],
			});
		});
	});
});

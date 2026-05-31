import { describe, expect, it } from "vitest";
import {
	buildCommitlintInvocation,
	buildPostCommitAdvice,
} from "../../src/commands/commit/hooks/post-commit-verify.js";

describe("buildCommitlintInvocation", () => {
	it("uses pnpm exec for pnpm projects", () => {
		expect(buildCommitlintInvocation("pnpm", "/r/cl.ts")).toEqual({
			command: "pnpm",
			args: ["exec", "commitlint", "--config", "/r/cl.ts", "--last"],
		});
	});

	it("uses yarn exec for yarn projects", () => {
		expect(buildCommitlintInvocation("yarn", "/r/cl.ts")).toEqual({
			command: "yarn",
			args: ["exec", "commitlint", "--config", "/r/cl.ts", "--last"],
		});
	});

	it("uses bunx for bun projects", () => {
		expect(buildCommitlintInvocation("bun", "/r/cl.ts")).toEqual({
			command: "bunx",
			args: ["commitlint", "--config", "/r/cl.ts", "--last"],
		});
	});

	it("uses npx --no -- for npm projects", () => {
		expect(buildCommitlintInvocation("npm", "/r/cl.ts")).toEqual({
			command: "npx",
			args: ["--no", "--", "commitlint", "--config", "/r/cl.ts", "--last"],
		});
	});

	it("omits --config when configPath is null", () => {
		expect(buildCommitlintInvocation("pnpm", null)).toEqual({
			command: "pnpm",
			args: ["exec", "commitlint", "--last"],
		});
	});
});

describe("buildPostCommitAdvice", () => {
	it("emits commitlint-fail line when commitlint output indicates failure", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: true,
			sigStatus: "G",
			autoSignEnabled: true,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toContain("commitlint --last");
	});

	it("emits unsigned advice when sigStatus N and autoSign on", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus: "N",
			autoSignEnabled: true,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toContain("--amend --no-edit -S");
	});

	it("does not emit signature advice when commit.gpgsign is off", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus: "N",
			autoSignEnabled: false,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toBeNull();
	});

	it("emits closes-missing advice when branch implies ticket but body has none", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus: "G",
			autoSignEnabled: true,
			branchTicketId: 42,
			bodyHasClosing: false,
		});
		expect(out).toContain("Closes: #42");
	});

	it("returns null when all checks pass", () => {
		expect(
			buildPostCommitAdvice({
				commitlintFailed: false,
				sigStatus: "G",
				autoSignEnabled: true,
				branchTicketId: 42,
				bodyHasClosing: true,
			}),
		).toBeNull();
	});
});

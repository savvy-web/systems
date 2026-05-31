import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { planLeakageRule } from "../../../../src/commitlint/hook/rules/plan-leakage.js";

const NULL_CTX = {} as never;
const check = (message: string) => Effect.runPromise(planLeakageRule.check({ message }, NULL_CTX));

describe("planLeakageRule", () => {
	it("advises when body references .claude/plans/", async () => {
		const hit = await check("subj\n\nsee .claude/plans/foo.md for context");
		expect(hit?.severity).toBe("advise");
		expect(hit?.message).toContain(".claude/plans");
	});

	it("advises when body references .claude/design/", async () => {
		const hit = await check("subj\n\nsee .claude/design/foo.md");
		expect(hit?.severity).toBe("advise");
	});

	it("advises on planning-narrative phrases", async () => {
		expect((await check("subj\n\nas decided in the plan, foo"))?.severity).toBe("advise");
		expect((await check("subj\n\npreviously documented as the only viable path"))?.severity).toBe("advise");
		expect((await check("subj\n\nsee the design doc for details"))?.severity).toBe("advise");
	});

	it("returns null for clean messages", async () => {
		expect(await check("subj\n\nadd thing")).toBeNull();
	});

	it("is case-insensitive", async () => {
		expect((await check("subj\n\nAs Decided In The Plan"))?.severity).toBe("advise");
	});
});

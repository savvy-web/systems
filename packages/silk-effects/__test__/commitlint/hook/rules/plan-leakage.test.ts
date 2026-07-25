import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { planLeakageRule } from "../../../../src/commitlint/hook/rules/plan-leakage.js";

const NULL_CTX = {} as never;
const check = (message: string) => planLeakageRule.check({ message }, NULL_CTX);

describe("planLeakageRule", () => {
	it.effect("advises when body references .claude/plans/", () =>
		Effect.gen(function* () {
			const hit = yield* check("subj\n\nsee .claude/plans/foo.md for context");
			expect(hit?.severity).toBe("advise");
			expect(hit?.message).toContain(".claude/plans");
		}),
	);

	it.effect("advises when body references .claude/design/", () =>
		Effect.gen(function* () {
			const hit = yield* check("subj\n\nsee .claude/design/foo.md");
			expect(hit?.severity).toBe("advise");
		}),
	);

	it.effect("advises on planning-narrative phrases", () =>
		Effect.gen(function* () {
			expect((yield* check("subj\n\nas decided in the plan, foo"))?.severity).toBe("advise");
			expect((yield* check("subj\n\npreviously documented as the only viable path"))?.severity).toBe("advise");
			expect((yield* check("subj\n\nsee the design doc for details"))?.severity).toBe("advise");
		}),
	);

	it.effect("returns null for clean messages", () =>
		Effect.gen(function* () {
			expect(yield* check("subj\n\nadd thing")).toBeNull();
		}),
	);

	it.effect("is case-insensitive", () =>
		Effect.gen(function* () {
			expect((yield* check("subj\n\nAs Decided In The Plan"))?.severity).toBe("advise");
		}),
	);
});

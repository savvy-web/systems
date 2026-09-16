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

	it.effect("advises when body references an okf/ bundle path", () =>
		Effect.gen(function* () {
			const bare = yield* check("subj\n\nsee okf/decisions/foo.md for the rationale");
			expect(bare?.severity).toBe("advise");
			expect(bare?.message).toContain("okf/");

			const dotted = yield* check("subj\n\nstart at ./okf/index.md");
			expect(dotted?.severity).toBe("advise");

			const lineStart = yield* check("subj\n\nokf/conventions/foo.md explains it");
			expect(lineStart?.severity).toBe("advise");

			const fenced = yield* check("subj\n\nsee `okf/modules/silk.md`");
			expect(fenced?.severity).toBe("advise");

			const linked = yield* check("subj\n\nsee [okf/decisions/foo.md](https://example.test/okf/decisions/foo.md)");
			expect(linked?.severity).toBe("advise");

			const bold = yield* check("subj\n\nmoved to **okf/** last week");
			expect(bold?.severity).toBe("advise");
		}),
	);

	it.effect("does not treat okfit or look-alike tokens as an okf/ path", () =>
		Effect.gen(function* () {
			expect(yield* check("subj\n\nrun okfit sync --staged before commit")).toBeNull();
			expect(yield* check("subj\n\nbump @okfit/plugin to 0.3.7")).toBeNull();
			expect(yield* check("subj\n\nmove bookf/ into the fixtures dir")).toBeNull();
			expect(yield* check("subj\n\ntighten the guard with no paths mentioned")).toBeNull();
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

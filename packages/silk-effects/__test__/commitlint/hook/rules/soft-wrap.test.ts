import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { softWrapRule } from "../../../../src/commitlint/hook/rules/soft-wrap.js";

const NULL_CTX = {} as never;
const check = (message: string) => softWrapRule.check({ message }, NULL_CTX);

describe("softWrapRule", () => {
	it.effect("advises on a bullet that has a continuation line < 80 chars without a bullet prefix", () =>
		Effect.gen(function* () {
			const msg = ["subject", "", "- this bullet wraps", "  unnecessarily across two lines"].join("\n");
			const hit = yield* check(msg);
			expect(hit?.severity).toBe("advise");
			expect(hit?.message).toContain("soft-wrap");
		}),
	);

	it.effect("does not flag a bullet whose continuation is the start of a new bullet", () =>
		Effect.gen(function* () {
			const msg = ["subject", "", "- bullet one is short", "- bullet two is also short"].join("\n");
			expect(yield* check(msg)).toBeNull();
		}),
	);

	it.effect("does not flag a single-line bullet that is over 80 chars", () =>
		Effect.gen(function* () {
			const msg = `subject\n\n- ${"x".repeat(150)}\n`;
			expect(yield* check(msg)).toBeNull();
		}),
	);

	it.effect("does not flag prose paragraphs", () =>
		Effect.gen(function* () {
			expect(yield* check("subj\n\nfirst paragraph\n\nsecond paragraph")).toBeNull();
		}),
	);
});

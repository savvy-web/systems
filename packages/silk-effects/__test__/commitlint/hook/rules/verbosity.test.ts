import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { verbosityRule } from "../../../../src/commitlint/hook/rules/verbosity.js";

const NULL_CTX = {} as never;
const check = (message: string) => verbosityRule.check({ message }, NULL_CTX);

describe("verbosityRule", () => {
	it.effect("advises when body has more than 25 lines", () =>
		Effect.gen(function* () {
			const body = Array(30).fill("body").join("\n");
			const hit = yield* check(`subject\n\n${body}`);
			expect(hit?.severity).toBe("advise");
			expect(hit?.message).toContain("lines");
		}),
	);

	it.effect("advises when body has more than 400 words", () =>
		Effect.gen(function* () {
			const word = "word";
			const body = Array(450).fill(word).join(" ");
			const hit = yield* check(`subject\n\n${body}`);
			expect(hit?.severity).toBe("advise");
			expect(hit?.message).toContain("words");
		}),
	);

	it.effect("returns null for short bodies", () =>
		Effect.gen(function* () {
			expect(yield* check("subject\n\nshort body")).toBeNull();
		}),
	);

	it.effect("counts only body, not subject", () =>
		Effect.gen(function* () {
			const subject = "x".repeat(2000);
			expect(yield* check(subject)).toBeNull();
		}),
	);
});

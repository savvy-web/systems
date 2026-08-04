import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
	VERBOSITY_LINE_THRESHOLD,
	VERBOSITY_WORD_THRESHOLD,
	verbosityRule,
} from "../../../../src/commitlint/hook/rules/verbosity.js";

const NULL_CTX = {} as never;
const check = (message: string) => verbosityRule.check({ message }, NULL_CTX);

describe("verbosityRule", () => {
	it.effect("advises when body exceeds the line threshold", () =>
		Effect.gen(function* () {
			const body = Array(VERBOSITY_LINE_THRESHOLD + 1)
				.fill("body")
				.join("\n");
			const hit = yield* check(`subject\n\n${body}`);
			expect(hit?.severity).toBe("advise");
			expect(hit?.message).toContain("lines");
		}),
	);

	it.effect("advises when body exceeds the word threshold", () =>
		Effect.gen(function* () {
			const body = Array(VERBOSITY_WORD_THRESHOLD + 1)
				.fill("word")
				.join(" ");
			const hit = yield* check(`subject\n\n${body}`);
			expect(hit?.severity).toBe("advise");
			expect(hit?.message).toContain("words");
		}),
	);

	it.effect("stays silent exactly at the line threshold", () =>
		Effect.gen(function* () {
			const body = Array(VERBOSITY_LINE_THRESHOLD).fill("body").join("\n");
			expect(yield* check(`subject\n\n${body}`)).toBeNull();
		}),
	);

	it.effect("stays silent exactly at the word threshold", () =>
		Effect.gen(function* () {
			const body = Array(VERBOSITY_WORD_THRESHOLD).fill("word").join(" ");
			expect(yield* check(`subject\n\n${body}`)).toBeNull();
		}),
	);

	// The house format is 3-5 bullets plus the two trailer lines, and the
	// counted body includes those trailers. A message at the top of that range
	// must not advise, or the rule fights the format it is meant to enforce.
	it.effect("stays silent for a maximal house-format message", () =>
		Effect.gen(function* () {
			const message = [
				"feat(actions): canonicalize GitHub Actions skills",
				"",
				"- Consolidate Actions skills into indexed guidance with focused references",
				"- Add action design and repository structure skills",
				"- Preload the complete Actions skill suite in action-engineer",
				"- Validate construct coverage across exported package APIs",
				"- Drop the superseded per-tool skill index",
				"",
				"Closes #244, #245",
				"",
				"Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>",
			].join("\n");
			expect(yield* check(message)).toBeNull();
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

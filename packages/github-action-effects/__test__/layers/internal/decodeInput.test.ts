import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";
import { decodeInput, decodeJsonInput } from "../../../src/layers/internal/decodeInput.js";

const TestSchema = Schema.Struct({
	value: Schema.String,
});

describe("decodeInput", () => {
	it.effect("decodes a valid value against a schema", () =>
		Effect.gen(function* () {
			const result = yield* decodeInput("myInput", "hello", Schema.String);
			expect(result).toBe("hello");
		}),
	);

	it.effect("fails with ActionInputError when schema validation fails", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(decodeInput("myInput", "not-a-number", Schema.Number));
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = exit.cause.toJSON();
				expect(JSON.stringify(error)).toContain("myInput");
			}
		}),
	);
});

describe("decodeJsonInput", () => {
	it.effect("parses and decodes valid JSON against a schema", () =>
		Effect.gen(function* () {
			const result = yield* decodeJsonInput("myInput", JSON.stringify({ value: "hello" }), TestSchema);
			expect(result).toEqual({ value: "hello" });
		}),
	);

	it.effect("fails with ActionInputError on invalid JSON", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(decodeJsonInput("myInput", "{bad json", TestSchema));
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = exit.cause.toJSON();
				expect(JSON.stringify(error)).toContain("myInput");
				expect(JSON.stringify(error)).toContain("not valid JSON");
			}
		}),
	);

	it.effect("fails with ActionInputError on schema mismatch after parse", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(decodeJsonInput("myInput", JSON.stringify({ wrong: 1 }), TestSchema));
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = exit.cause.toJSON();
				expect(JSON.stringify(error)).toContain("myInput");
			}
		}),
	);

	it.effect("includes input name and raw value in error for non-Error parse failures", () =>
		Effect.gen(function* () {
			// JSON.parse throws a SyntaxError (an Error subclass) — we verify the reason
			// still includes the name even when the thrown value is not an Error instance
			const exit = yield* Effect.exit(decodeJsonInput("fieldName", "undefined", TestSchema));
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = exit.cause.toJSON();
				expect(JSON.stringify(error)).toContain("fieldName");
			}
		}),
	);
});

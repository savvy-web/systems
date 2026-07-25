import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";
import { decodeState, encodeState } from "../../../src/layers/internal/decodeState.js";

const TestSchema = Schema.Struct({
	value: Schema.String,
});

describe("decodeState", () => {
	it.effect("decodes valid JSON with matching schema", () =>
		Effect.gen(function* () {
			const result = yield* decodeState("key", JSON.stringify({ value: "hello" }), TestSchema);
			expect(result).toEqual({ value: "hello" });
		}),
	);

	it.effect("fails on invalid JSON", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(decodeState("key", "not-json", TestSchema));
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("fails on schema mismatch", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(decodeState("key", JSON.stringify({ wrong: 1 }), TestSchema));
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("includes key in error reason for invalid JSON", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(decodeState("myKey", "{bad", TestSchema));
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = exit.cause.toJSON();
				expect(JSON.stringify(error)).toContain("myKey");
			}
		}),
	);
});

describe("encodeState", () => {
	it.effect("encodes a valid value to JSON string", () =>
		Effect.gen(function* () {
			const result = yield* encodeState("key", { value: "hello" }, TestSchema);
			expect(result).toBe(JSON.stringify({ value: "hello" }));
		}),
	);

	it.effect("fails when encoding an invalid value", () =>
		Effect.gen(function* () {
			const StrictSchema = Schema.Struct({ n: Schema.Number });
			const exit = yield* Effect.exit(
				encodeState("key", { n: "not-a-number" } as unknown as { n: number }, StrictSchema),
			);
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);
});

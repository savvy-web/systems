import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Ref } from "effect";
import { RateLimitState } from "../../src/services/RateLimitState.js";

describe("RateLimitState", () => {
	it.effect("seeds an empty snapshot", () =>
		Effect.gen(function* () {
			const result = yield* Effect.gen(function* () {
				const ref = yield* RateLimitState;
				return yield* Ref.get(ref);
			}).pipe(Effect.provide(RateLimitState.Default));
			expect(Option.isNone(result)).toBe(true);
		}),
	);

	it.effect("can hold a snapshot once written", () =>
		Effect.gen(function* () {
			const result = yield* Effect.gen(function* () {
				const ref = yield* RateLimitState;
				yield* Ref.set(
					ref,
					Option.some({ remaining: 10, limit: 5000, resetEpochSeconds: 1700000000, observedAt: 123 }),
				);
				return yield* Ref.get(ref);
			}).pipe(Effect.provide(RateLimitState.Default));
			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value.remaining).toBe(10);
			}
		}),
	);
});

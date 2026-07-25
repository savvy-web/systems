import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { RateLimiterTest } from "../../src/layers/RateLimiterTest.js";
import { RateLimiter } from "../../src/services/RateLimiter.js";

const provide = <A, E>(state: ReturnType<typeof RateLimiterTest.empty>, effect: Effect.Effect<A, E, RateLimiter>) =>
	Effect.provide(effect, RateLimiterTest.layer(state));

const run = <A, E>(state: ReturnType<typeof RateLimiterTest.empty>, effect: Effect.Effect<A, E, RateLimiter>) =>
	provide(state, effect);

describe("RateLimiter", () => {
	describe("checkRest", () => {
		it.effect("returns configured rest status", () =>
			Effect.gen(function* () {
				const state = RateLimiterTest.empty();
				state.restStatus = { limit: 5000, remaining: 4500, reset: state.restStatus.reset, used: 500 };

				const result = yield* run(
					state,
					Effect.flatMap(RateLimiter, (svc) => svc.checkRest()),
				);

				expect(result.remaining).toBe(4500);
				expect(result.used).toBe(500);
				expect(state.checkRestCalls).toHaveLength(1);
			}),
		);
	});

	describe("checkGraphQL", () => {
		it.effect("returns configured graphql status", () =>
			Effect.gen(function* () {
				const state = RateLimiterTest.empty();
				state.graphqlStatus = { limit: 5000, remaining: 3000, reset: state.graphqlStatus.reset, used: 2000 };

				const result = yield* run(
					state,
					Effect.flatMap(RateLimiter, (svc) => svc.checkGraphQL()),
				);

				expect(result.remaining).toBe(3000);
				expect(result.limit).toBe(5000);
				expect(state.checkGraphQLCalls).toHaveLength(1);
			}),
		);
	});

	describe("withRateLimit", () => {
		it.effect("runs effect when under threshold", () =>
			Effect.gen(function* () {
				const state = RateLimiterTest.empty();
				const result = yield* run(
					state,
					Effect.flatMap(RateLimiter, (svc) => svc.withRateLimit(Effect.succeed("ok"))),
				);
				expect(result).toBe("ok");
			}),
		);
	});

	describe("withRetry", () => {
		it.effect("runs effect directly in test layer", () =>
			Effect.gen(function* () {
				const state = RateLimiterTest.empty();
				const result = yield* run(
					state,
					Effect.flatMap(RateLimiter, (svc) => svc.withRetry(Effect.succeed(42))),
				);
				expect(result).toBe(42);
			}),
		);
	});
});

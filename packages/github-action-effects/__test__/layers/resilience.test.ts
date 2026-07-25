import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Clock, Duration, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";
import { GitHubClientError } from "../../src/errors/GitHubClientError.js";
import { resilienceSchedule, withResilience } from "../../src/layers/resilience.js";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

const retryableError = (overrides?: Partial<{ status: number; retryAfterMs: number }>) =>
	new GitHubClientError({
		operation: "test",
		status: overrides?.status ?? 503,
		reason: "transient",
		retryable: true,
		retryAfterMs: overrides?.retryAfterMs,
	});

const nonRetryableError = () =>
	new GitHubClientError({
		operation: "test",
		status: 404,
		reason: "not found",
		retryable: false,
		retryAfterMs: undefined,
	});

/** Run an effect that uses TestClock-driven delays; advance the clock then join. */
const runWithClock = <A, E>(effect: Effect.Effect<A, E>, advance = Duration.seconds(600)) =>
	Effect.gen(function* () {
		const fiber = yield* Effect.forkChild(effect);
		yield* TestClock.adjust(advance);
		return yield* Fiber.join(fiber);
	}).pipe(Effect.exit);

describe("resilienceSchedule", () => {
	it.effect("does not retry non-retryable errors (single attempt)", () =>
		Effect.gen(function* () {
			const counter = yield* Ref.make(0);
			const exit = yield* runWithClock(
				withResilience(
					Effect.flatMap(
						Ref.updateAndGet(counter, (x) => x + 1),
						() => Effect.fail(nonRetryableError()),
					),
					{ maxRetries: 4 },
				),
			);
			const count = yield* Ref.get(counter);
			expect(exit._tag).toBe("Failure");
			expect(count).toBe(1);
		}),
	);

	it.effect("recovers after transient failures within maxRetries", () =>
		Effect.gen(function* () {
			const counter = yield* Ref.make(0);
			const exit = yield* runWithClock(
				withResilience(
					Effect.gen(function* () {
						const n = yield* Ref.updateAndGet(counter, (x) => x + 1);
						if (n < 3) return yield* Effect.fail(retryableError());
						return n;
					}),
					{ maxRetries: 4, baseDelay: Duration.seconds(1) },
				),
			);
			const count = yield* Ref.get(counter);
			expect(exit._tag).toBe("Success");
			expect(count).toBe(3);
		}),
	);

	it.effect("gives up after maxRetries on persistent retryable errors", () =>
		Effect.gen(function* () {
			const counter = yield* Ref.make(0);
			const exit = yield* runWithClock(
				withResilience(
					Effect.flatMap(
						Ref.updateAndGet(counter, (x) => x + 1),
						() => Effect.fail(retryableError()),
					),
					{ maxRetries: 4, baseDelay: Duration.seconds(1) },
				),
			);
			const count = yield* Ref.get(counter);
			expect(exit._tag).toBe("Failure");
			// 1 initial + 4 retries = 5 total attempts
			expect(count).toBe(5);
		}),
	);

	it.effect("disabled resilience does not retry", () =>
		Effect.gen(function* () {
			const counter = yield* Ref.make(0);
			const exit = yield* runWithClock(
				withResilience(
					Effect.flatMap(
						Ref.updateAndGet(counter, (x) => x + 1),
						() => Effect.fail(retryableError()),
					),
					{ enabled: false },
				),
			);
			const count = yield* Ref.get(counter);
			expect(exit._tag).toBe("Failure");
			expect(count).toBe(1);
		}),
	);

	it.effect("caps each backoff delay at maxDelay", () =>
		Effect.gen(function* () {
			// Record the wall-clock time before each attempt to measure inter-attempt sleeps.
			const timestamps = yield* Ref.make<Array<number>>([]);
			const counter = yield* Ref.make(0);
			yield* runWithClock(
				withResilience(
					Effect.gen(function* () {
						const now = yield* Clock.currentTimeMillis;
						yield* Ref.update(timestamps, (xs) => [...xs, now]);
						const n = yield* Ref.updateAndGet(counter, (x) => x + 1);
						if (n < 5) return yield* Effect.fail(retryableError());
						return n;
					}),
					{ maxRetries: 10, baseDelay: Duration.seconds(1), maxDelay: Duration.seconds(5) },
				),
			);
			const stamps = yield* Ref.get(timestamps);
			const deltas = stamps.slice(1).map((t, i) => t - stamps[i]);
			// With baseDelay 1s doubling (1,2,4,8,...) but capped at 5s, no inter-attempt
			// sleep may exceed the cap (allow small jitter slack above the cap).
			for (const d of deltas) {
				expect(d).toBeLessThanOrEqual(5000 + 1);
			}
		}),
	);

	it.effect("honors retryAfterMs over the exponential backoff", () =>
		Effect.gen(function* () {
			const timestamps = yield* Ref.make<Array<number>>([]);
			const counter = yield* Ref.make(0);
			const exit = yield* runWithClock(
				withResilience(
					Effect.gen(function* () {
						const now = yield* Clock.currentTimeMillis;
						yield* Ref.update(timestamps, (xs) => [...xs, now]);
						const n = yield* Ref.updateAndGet(counter, (x) => x + 1);
						// First attempt fails with a server-advised 7s delay, then succeeds.
						if (n < 2) return yield* Effect.fail(retryableError({ retryAfterMs: 7000 }));
						return n;
					}),
					{ maxRetries: 4, baseDelay: Duration.seconds(1), maxDelay: Duration.seconds(30) },
				),
			);
			const stamps = yield* Ref.get(timestamps);
			expect(exit._tag).toBe("Success");
			// The single inter-attempt sleep must be the advised 7s, not the 1s base.
			expect(stamps.length).toBe(2);
			expect(stamps[1] - stamps[0]).toBeGreaterThanOrEqual(7000);
		}),
	);

	it.effect("falls back to exponential when retryAfterMs is absent", () =>
		Effect.gen(function* () {
			const timestamps = yield* Ref.make<Array<number>>([]);
			const counter = yield* Ref.make(0);
			yield* runWithClock(
				withResilience(
					Effect.gen(function* () {
						const now = yield* Clock.currentTimeMillis;
						yield* Ref.update(timestamps, (xs) => [...xs, now]);
						const n = yield* Ref.updateAndGet(counter, (x) => x + 1);
						if (n < 2) return yield* Effect.fail(retryableError());
						return n;
					}),
					{ maxRetries: 4, baseDelay: Duration.seconds(1), maxDelay: Duration.seconds(30) },
				),
			);
			const stamps = yield* Ref.get(timestamps);
			// The single inter-attempt sleep is roughly the 1s base (jittered, so < 7s).
			expect(stamps[1] - stamps[0]).toBeLessThan(7000);
		}),
	);

	it.effect("resilienceSchedule retries retryable errors and stops at maxRetries", () =>
		Effect.gen(function* () {
			const counter = yield* Ref.make(0);
			const exit = yield* runWithClock(
				Effect.flatMap(
					Ref.updateAndGet(counter, (x) => x + 1),
					() => Effect.fail(retryableError()),
				).pipe(Effect.retry(resilienceSchedule({ maxRetries: 2, baseDelay: Duration.seconds(1) }))),
			);
			const count = yield* Ref.get(counter);
			expect(exit._tag).toBe("Failure");
			// 1 initial + 2 retries = 3 attempts.
			expect(count).toBe(3);
		}),
	);

	it.effect("resilienceSchedule does not recur on non-retryable errors", () =>
		Effect.gen(function* () {
			const counter = yield* Ref.make(0);
			const exit = yield* runWithClock(
				Effect.flatMap(
					Ref.updateAndGet(counter, (x) => x + 1),
					() => Effect.fail(nonRetryableError()),
				).pipe(Effect.retry(resilienceSchedule({ maxRetries: 4 }))),
			);
			const count = yield* Ref.get(counter);
			expect(exit._tag).toBe("Failure");
			expect(count).toBe(1);
		}),
	);
});

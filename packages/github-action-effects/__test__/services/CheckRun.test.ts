import { describe, expect, it } from "@effect/vitest";
import { Data, Effect, Exit } from "effect";
import { CheckRunError } from "../../src/errors/CheckRunError.js";
import { CheckRunTest } from "../../src/layers/CheckRunTest.js";
import { CheckRun } from "../../src/services/CheckRun.js";

// -- Shared provide helper --

const run = <A, E>(state: ReturnType<typeof CheckRunTest.empty>, effect: Effect.Effect<A, E, CheckRun>) =>
	Effect.provide(effect, CheckRunTest.layer(state));

const runExit = <A, E>(state: ReturnType<typeof CheckRunTest.empty>, effect: Effect.Effect<A, E, CheckRun>) =>
	Effect.exit(run(state, effect));

// -- Service method shorthands --

const create = (name: string, headSha: string) => Effect.flatMap(CheckRun, (svc) => svc.create(name, headSha));

const withCheckRun = <A, E>(name: string, headSha: string, effect: (checkRunId: number) => Effect.Effect<A, E>) =>
	Effect.flatMap(CheckRun, (svc) => svc.withCheckRun(name, headSha, effect));

describe("CheckRun", () => {
	describe("create", () => {
		it.effect("creates a check run and returns an ID", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				const data = yield* run(state, create("lint", "abc123"));
				expect(data.id).toBe(1);
				expect(state.runs).toHaveLength(1);
				expect(state.runs[0]).toMatchObject({
					id: 1,
					name: "lint",
					headSha: "abc123",
					status: "in_progress",
				});
			}),
		);

		it.effect("assigns incrementing IDs", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				const data1 = yield* run(state, create("lint", "abc"));
				const data2 = yield* run(state, create("test", "def"));
				expect(data2.id).toBe(data1.id + 1);
				expect(state.runs).toHaveLength(2);
			}),
		);

		it.effect("returns CheckRunData with htmlUrl", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				const data = yield* run(state, create("build", "sha1"));
				expect(data.htmlUrl).toBe("https://github.com/test/checks/1");
				expect(data.status).toBe("in_progress");
				expect(data.conclusion).toBeNull();
			}),
		);
	});

	describe("update", () => {
		it.effect("silently ignores update for non-existent check run id", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				// Should not throw — run with unknown id is a no-op
				yield* run(
					state,
					Effect.flatMap(CheckRun, (svc) => svc.update(999, { title: "Phantom", summary: "No run" })),
				);
				expect(state.runs).toHaveLength(0);
			}),
		);

		it.effect("adds output to an existing check run", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* CheckRun;
						const checkRun = yield* svc.create("lint", "abc123");
						yield* svc.update(checkRun.id, { title: "Results", summary: "All good" });
					}),
				);
				expect(state.runs[0].outputs).toHaveLength(1);
				expect(state.runs[0].outputs[0]).toMatchObject({
					title: "Results",
					summary: "All good",
				});
			}),
		);

		it.effect("appends multiple outputs", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* CheckRun;
						const checkRun = yield* svc.create("lint", "abc123");
						yield* svc.update(checkRun.id, { title: "Step 1", summary: "Done" });
						yield* svc.update(checkRun.id, { title: "Step 2", summary: "Done" });
					}),
				);
				expect(state.runs[0].outputs).toHaveLength(2);
			}),
		);
	});

	describe("complete", () => {
		it.effect("silently ignores complete for non-existent check run id", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				yield* run(
					state,
					Effect.flatMap(CheckRun, (svc) => svc.complete(999, "success")),
				);
				expect(state.runs).toHaveLength(0);
			}),
		);

		it.effect("marks check run as completed with conclusion", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* CheckRun;
						const checkRun = yield* svc.create("lint", "abc123");
						yield* svc.complete(checkRun.id, "success");
					}),
				);
				expect(state.runs[0].status).toBe("completed");
				expect(state.runs[0].conclusion).toBe("success");
			}),
		);

		it.effect("attaches final output when provided", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* CheckRun;
						const checkRun = yield* svc.create("lint", "abc123");
						yield* svc.complete(checkRun.id, "failure", { title: "Failed", summary: "2 errors" });
					}),
				);
				expect(state.runs[0].conclusion).toBe("failure");
				expect(state.runs[0].outputs).toHaveLength(1);
				expect(state.runs[0].outputs[0].title).toBe("Failed");
			}),
		);
	});

	describe("withCheckRun", () => {
		it.effect("creates and completes with success on successful effect", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				const result = yield* run(
					state,
					withCheckRun("lint", "abc123", (_checkRunId) => Effect.succeed("done")),
				);
				expect(result).toBe("done");
				expect(state.runs).toHaveLength(1);
				expect(state.runs[0].status).toBe("completed");
				expect(state.runs[0].conclusion).toBe("success");
			}),
		);

		it.effect("creates and completes with failure on failed effect", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();

				class TestError extends Data.TaggedError("TestError")<{ readonly message: string }> {}

				const exit = yield* runExit(
					state,
					withCheckRun("lint", "abc123", (_checkRunId) => Effect.fail(new TestError({ message: "boom" }))),
				);

				expect(Exit.isFailure(exit)).toBe(true);
				expect(state.runs).toHaveLength(1);
				expect(state.runs[0].status).toBe("completed");
				expect(state.runs[0].conclusion).toBe("failure");
			}),
		);

		it.effect("passes the check run ID to the effect", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();
				const result = yield* run(
					state,
					withCheckRun("lint", "abc123", (checkRunId) => Effect.succeed(checkRunId)),
				);
				expect(result).toBe(1);
			}),
		);

		it.effect("propagates the original error after completing with failure", () =>
			Effect.gen(function* () {
				const state = CheckRunTest.empty();

				class MyError extends Data.TaggedError("MyError")<{ readonly code: number }> {}

				const exit = yield* runExit(
					state,
					withCheckRun("lint", "abc123", (_id) => Effect.fail(new MyError({ code: 42 }))),
				);

				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					const error = exit.cause;
					// The original error should be in the cause
					expect(String(error)).toContain("MyError");
				}
			}),
		);
	});

	describe("CheckRunError", () => {
		it("is a tagged error with correct fields", () => {
			const error = new CheckRunError({
				name: "lint",
				operation: "create",
				reason: "API rate limited",
			});
			expect(error._tag).toBe("CheckRunError");
			expect(error.name).toBe("lint");
			expect(error.operation).toBe("create");
			expect(error.reason).toBe("API rate limited");
		});
	});
});

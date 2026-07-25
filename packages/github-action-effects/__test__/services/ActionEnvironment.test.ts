import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { ActionEnvironmentError } from "../../src/errors/ActionEnvironmentError.js";
import { ActionEnvironmentTest } from "../../src/layers/ActionEnvironmentTest.js";
import { ActionEnvironment } from "../../src/services/ActionEnvironment.js";

// -- Shared provide helper --

const provide = <A, E>(env: Record<string, string>, effect: Effect.Effect<A, E, ActionEnvironment>) =>
	Effect.provide(effect, ActionEnvironmentTest.layer(env));

const provideEmpty = <A, E>(effect: Effect.Effect<A, E, ActionEnvironment>) =>
	Effect.provide(effect, ActionEnvironmentTest.empty());

const run = <A, E>(env: Record<string, string>, effect: Effect.Effect<A, E, ActionEnvironment>) => provide(env, effect);

const runEmpty = <A, E>(effect: Effect.Effect<A, E, ActionEnvironment>) => provideEmpty(effect);

const runExit = <A, E>(env: Record<string, string>, effect: Effect.Effect<A, E, ActionEnvironment>) =>
	Effect.exit(provide(env, effect));

const runExitEmpty = <A, E>(effect: Effect.Effect<A, E, ActionEnvironment>) => Effect.exit(provideEmpty(effect));

// -- Service method shorthands --

const get = (name: string) => Effect.flatMap(ActionEnvironment, (svc) => svc.get(name));

const getOptional = (name: string) => Effect.flatMap(ActionEnvironment, (svc) => svc.getOptional(name));

const github = Effect.flatMap(ActionEnvironment, (svc) => svc.github);

const runner = Effect.flatMap(ActionEnvironment, (svc) => svc.runner);

describe("ActionEnvironment", () => {
	describe("get", () => {
		it.effect("reads an environment variable", () =>
			Effect.gen(function* () {
				const result = yield* run({ MY_VAR: "hello" }, get("MY_VAR"));
				expect(result).toBe("hello");
			}),
		);

		it.effect("fails on missing variable", () =>
			Effect.gen(function* () {
				const exit = yield* runExit({}, get("MISSING_VAR"));
				expect(exit._tag).toBe("Failure");
			}),
		);

		it.effect("fails on empty string variable", () =>
			Effect.gen(function* () {
				const exit = yield* runExit({ EMPTY_VAR: "" }, get("EMPTY_VAR"));
				expect(exit._tag).toBe("Failure");
			}),
		);

		it.effect("returns the correct error for missing variable", () =>
			Effect.gen(function* () {
				const exit = yield* runExitEmpty(get("NOT_SET"));
				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					const cause = exit.cause;
					const error = Option.getOrUndefined(Cause.findErrorOption(cause));
					expect(error).toBeInstanceOf(ActionEnvironmentError);
					if (error instanceof ActionEnvironmentError) {
						expect(error.variable).toBe("NOT_SET");
					}
				}
			}),
		);
	});

	describe("getOptional", () => {
		it.effect("returns Some for set variable", () =>
			Effect.gen(function* () {
				const result = yield* run({ MY_VAR: "value" }, getOptional("MY_VAR"));
				expect(Option.isSome(result)).toBe(true);
				if (Option.isSome(result)) {
					expect(result.value).toBe("value");
				}
			}),
		);

		it.effect("returns None for missing variable", () =>
			Effect.gen(function* () {
				const result = yield* run({}, getOptional("MISSING"));
				expect(Option.isNone(result)).toBe(true);
			}),
		);

		it.effect("returns None for empty string variable", () =>
			Effect.gen(function* () {
				const result = yield* run({ EMPTY: "" }, getOptional("EMPTY"));
				expect(Option.isNone(result)).toBe(true);
			}),
		);
	});

	describe("github", () => {
		it.effect("returns default context from empty layer", () =>
			Effect.gen(function* () {
				const ctx = yield* runEmpty(github);
				expect(ctx.sha).toBe("abc1234567890def");
				expect(ctx.ref).toBe("refs/heads/main");
				expect(ctx.repository).toBe("owner/repo");
				expect(ctx.repositoryOwner).toBe("owner");
				expect(ctx.workspace).toBe("/home/runner/work/repo/repo");
				expect(ctx.eventName).toBe("push");
				expect(ctx.runId).toBe("12345");
				expect(ctx.actor).toBe("test-user");
				expect(ctx.serverUrl).toBe("https://github.com");
				expect(ctx.apiUrl).toBe("https://api.github.com");
				expect(ctx.graphqlUrl).toBe("https://api.github.com/graphql");
				expect(ctx.action).toBe("test-action");
				expect(ctx.job).toBe("test-job");
				expect(ctx.workflow).toBe("Test Workflow");
			}),
		);

		it.effect("reads from env record when provided", () =>
			Effect.gen(function* () {
				const ctx = yield* run(
					{
						GITHUB_SHA: "custom-sha",
						GITHUB_REF: "refs/tags/v1.0.0",
						GITHUB_REPOSITORY: "my-org/my-repo",
					},
					github,
				);
				expect(ctx.sha).toBe("custom-sha");
				expect(ctx.ref).toBe("refs/tags/v1.0.0");
				expect(ctx.repository).toBe("my-org/my-repo");
				// Defaults still used for unset values
				expect(ctx.actor).toBe("test-user");
			}),
		);

		it.effect("returns all 16 fields", () =>
			Effect.gen(function* () {
				const ctx = yield* runEmpty(github);
				const keys = Object.keys(ctx);
				expect(keys).toHaveLength(16);
				expect(keys).toContain("sha");
				expect(keys).toContain("ref");
				expect(keys).toContain("repository");
				expect(keys).toContain("repositoryOwner");
				expect(keys).toContain("workspace");
				expect(keys).toContain("eventName");
				expect(keys).toContain("eventPath");
				expect(keys).toContain("runId");
				expect(keys).toContain("runNumber");
				expect(keys).toContain("actor");
				expect(keys).toContain("serverUrl");
				expect(keys).toContain("apiUrl");
				expect(keys).toContain("graphqlUrl");
				expect(keys).toContain("action");
				expect(keys).toContain("job");
				expect(keys).toContain("workflow");
			}),
		);
	});

	describe("runner", () => {
		it.effect("returns default context from empty layer", () =>
			Effect.gen(function* () {
				const ctx = yield* runEmpty(runner);
				expect(ctx.os).toBe("Linux");
				expect(ctx.arch).toBe("X64");
				expect(ctx.name).toBe("test-runner");
				expect(ctx.temp).toBe("/tmp");
				expect(ctx.toolCache).toBe("/opt/hostedtoolcache");
				expect(ctx.debug).toBe(false);
			}),
		);

		it.effect("reads from env record when provided", () =>
			Effect.gen(function* () {
				const ctx = yield* run(
					{
						RUNNER_OS: "macOS",
						RUNNER_ARCH: "ARM64",
					},
					runner,
				);
				expect(ctx.os).toBe("macOS");
				expect(ctx.arch).toBe("ARM64");
				// Defaults for unset values
				expect(ctx.name).toBe("test-runner");
			}),
		);

		it.effect("sets debug to true when RUNNER_DEBUG is 1", () =>
			Effect.gen(function* () {
				const ctx = yield* run({ RUNNER_DEBUG: "1" }, runner);
				expect(ctx.debug).toBe(true);
			}),
		);

		it.effect("sets debug to false when RUNNER_DEBUG is not 1", () =>
			Effect.gen(function* () {
				const ctx = yield* run({ RUNNER_DEBUG: "0" }, runner);
				expect(ctx.debug).toBe(false);
			}),
		);

		it.effect("sets debug to false when RUNNER_DEBUG is not set", () =>
			Effect.gen(function* () {
				const ctx = yield* run({}, runner);
				expect(ctx.debug).toBe(false);
			}),
		);
	});

	describe("ActionEnvironmentError", () => {
		it("is a tagged error with correct tag", () => {
			const error = new ActionEnvironmentError({
				variable: "MY_VAR",
				reason: "not set",
			});
			expect(error._tag).toBe("ActionEnvironmentError");
			expect(error.variable).toBe("MY_VAR");
			expect(error.reason).toBe("not set");
		});
	});
});

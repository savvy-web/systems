import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import type { FileSystem } from "effect";
import { Effect, Layer } from "effect";
import { ActionEnvironmentTest } from "../../src/layers/ActionEnvironmentTest.js";
import { ActionEnvironment } from "../../src/services/ActionEnvironment.js";

// payload/repo/issue carry a FileSystem requirement in their interface type
// (even though the Test layer does not use it), so tests provide one.
type Deps = ActionEnvironment | FileSystem.FileSystem;

const runEmpty = <A, E>(effect: Effect.Effect<A, E, Deps>) =>
	Effect.provide(effect, Layer.merge(ActionEnvironmentTest.empty(), NodeFileSystem.layer));

const runLayer = <A, E>(
	env: Record<string, string>,
	payload: Parameters<typeof ActionEnvironmentTest.layer>[1],
	effect: Effect.Effect<A, E, Deps>,
) => Effect.provide(effect, Layer.merge(ActionEnvironmentTest.layer(env, payload), NodeFileSystem.layer));

const exitLayer = <A, E>(
	env: Record<string, string>,
	payload: Parameters<typeof ActionEnvironmentTest.layer>[1],
	effect: Effect.Effect<A, E, Deps>,
) => Effect.exit(Effect.provide(effect, Layer.merge(ActionEnvironmentTest.layer(env, payload), NodeFileSystem.layer)));

describe("ActionEnvironmentTest", () => {
	describe("empty", () => {
		it.effect("payload is {}", () =>
			Effect.gen(function* () {
				const result = yield* runEmpty(Effect.flatMap(ActionEnvironment, (svc) => svc.payload));
				expect(result).toEqual({});
			}),
		);

		it.effect("isDebug is false", () =>
			Effect.gen(function* () {
				const result = yield* runEmpty(Effect.flatMap(ActionEnvironment, (svc) => svc.isDebug));
				expect(result).toBe(false);
			}),
		);

		it.effect("repo derives from the default owner/repo", () =>
			Effect.gen(function* () {
				const result = yield* runEmpty(Effect.flatMap(ActionEnvironment, (svc) => svc.repo));
				expect(result).toEqual({ owner: "owner", repo: "repo" });
			}),
		);

		it.effect("issue fails (no number seeded)", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(
					Effect.provide(
						Effect.flatMap(ActionEnvironment, (svc) => svc.issue),
						Layer.merge(ActionEnvironmentTest.empty(), NodeFileSystem.layer),
					),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("layer", () => {
		it.effect("isDebug reads RUNNER_DEBUG", () =>
			Effect.gen(function* () {
				const result = yield* runLayer(
					{ RUNNER_DEBUG: "1" },
					{},
					Effect.flatMap(ActionEnvironment, (svc) => svc.isDebug),
				);
				expect(result).toBe(true);
			}),
		);

		it.effect("accepts an injected payload", () =>
			Effect.gen(function* () {
				const result = yield* runLayer(
					{},
					{ pull_request: { number: 5 } },
					Effect.flatMap(ActionEnvironment, (svc) => svc.payload),
				);
				expect(result.pull_request?.number).toBe(5);
			}),
		);

		it.effect("repo reads GITHUB_REPOSITORY from the env record", () =>
			Effect.gen(function* () {
				const result = yield* runLayer(
					{ GITHUB_REPOSITORY: "acme/widgets" },
					{},
					Effect.flatMap(ActionEnvironment, (svc) => svc.repo),
				);
				expect(result).toEqual({ owner: "acme", repo: "widgets" });
			}),
		);

		it.effect("issue cascade resolves from the injected payload", () =>
			Effect.gen(function* () {
				const result = yield* runLayer(
					{ GITHUB_REPOSITORY: "acme/widgets" },
					{ issue: { number: 11 } },
					Effect.flatMap(ActionEnvironment, (svc) => svc.issue),
				);
				expect(result).toEqual({ owner: "acme", repo: "widgets", number: 11 });
			}),
		);

		it.effect("issue fails when neither env nor payload supply a number", () =>
			Effect.gen(function* () {
				const exit = yield* exitLayer(
					{},
					{},
					Effect.flatMap(ActionEnvironment, (svc) => svc.issue),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});
});

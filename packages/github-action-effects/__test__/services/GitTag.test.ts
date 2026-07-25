import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { GitTagError } from "../../src/errors/GitTagError.js";
import { GitTagTest } from "../../src/layers/GitTagTest.js";
import { GitTag } from "../../src/services/GitTag.js";

// -- Shared provide helper --

const provide = <A, E>(layer: ReturnType<typeof GitTagTest.empty>["layer"], effect: Effect.Effect<A, E, GitTag>) =>
	Effect.provide(effect, layer);

const run = <A, E>(layer: ReturnType<typeof GitTagTest.empty>["layer"], effect: Effect.Effect<A, E, GitTag>) =>
	provide(layer, effect);

const runExit = <A, E>(layer: ReturnType<typeof GitTagTest.empty>["layer"], effect: Effect.Effect<A, E, GitTag>) =>
	Effect.exit(provide(layer, effect));

// -- Service method shorthands --

const create = (tag: string, sha: string) => Effect.flatMap(GitTag, (svc) => svc.create(tag, sha));
const del = (tag: string) => Effect.flatMap(GitTag, (svc) => svc.delete(tag));
const list = (prefix?: string) => Effect.flatMap(GitTag, (svc) => svc.list(prefix));
const resolve = (tag: string) => Effect.flatMap(GitTag, (svc) => svc.resolve(tag));

describe("GitTag", () => {
	describe("create", () => {
		it.effect("creates a tag", () =>
			Effect.gen(function* () {
				const { state, layer } = GitTagTest.empty();
				yield* run(layer, create("v1.0.0", "abc123"));
				expect(state.tags.get("v1.0.0")).toBe("abc123");
				expect(state.createCalls).toEqual([{ tag: "v1.0.0", sha: "abc123" }]);
			}),
		);
	});

	describe("delete", () => {
		it.effect("deletes a tag", () =>
			Effect.gen(function* () {
				const { state, layer } = GitTagTest.empty();
				state.tags.set("v1.0.0", "abc123");
				yield* run(layer, del("v1.0.0"));
				expect(state.tags.has("v1.0.0")).toBe(false);
				expect(state.deleteCalls).toEqual(["v1.0.0"]);
			}),
		);

		it.effect("fails to delete unknown tag", () =>
			Effect.gen(function* () {
				const { layer } = GitTagTest.empty();
				const exit = yield* runExit(layer, del("v999.0.0"));
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("list", () => {
		it.effect("lists with prefix filter", () =>
			Effect.gen(function* () {
				const { state, layer } = GitTagTest.empty();
				state.tags.set("v1.0.0", "sha1");
				state.tags.set("v1.1.0", "sha2");
				state.tags.set("v2.0.0", "sha3");
				const result = yield* run(layer, list("v1."));
				expect(result).toEqual([
					{ tag: "v1.0.0", sha: "sha1" },
					{ tag: "v1.1.0", sha: "sha2" },
				]);
			}),
		);
	});

	describe("resolve", () => {
		it.effect("resolves a tag to SHA", () =>
			Effect.gen(function* () {
				const { state, layer } = GitTagTest.empty();
				state.tags.set("v1.0.0", "abc123");
				const sha = yield* run(layer, resolve("v1.0.0"));
				expect(sha).toBe("abc123");
			}),
		);

		it.effect("fails to resolve unknown tag", () =>
			Effect.gen(function* () {
				const { layer } = GitTagTest.empty();
				const exit = yield* runExit(layer, resolve("v999.0.0"));
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("GitTagError", () => {
		it("is a tagged error with correct fields", () => {
			const error = new GitTagError({
				operation: "create",
				tag: "v1.0.0",
				reason: "ref already exists",
			});
			expect(error._tag).toBe("GitTagError");
			expect(error.operation).toBe("create");
			expect(error.tag).toBe("v1.0.0");
			expect(error.reason).toBe("ref already exists");
		});
	});
});

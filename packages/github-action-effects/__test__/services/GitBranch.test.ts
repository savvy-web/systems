import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { GitBranchError } from "../../src/errors/GitBranchError.js";
import { GitBranchTest } from "../../src/layers/GitBranchTest.js";
import { GitBranch } from "../../src/services/GitBranch.js";

// -- Shared provide helper --

const provide = <A, E>(state: ReturnType<typeof GitBranchTest.empty>, effect: Effect.Effect<A, E, GitBranch>) =>
	Effect.provide(effect, GitBranchTest.layer(state));

const run = <A, E>(state: ReturnType<typeof GitBranchTest.empty>, effect: Effect.Effect<A, E, GitBranch>) =>
	provide(state, effect);

const runExit = <A, E>(state: ReturnType<typeof GitBranchTest.empty>, effect: Effect.Effect<A, E, GitBranch>) =>
	Effect.exit(provide(state, effect));

// -- Service method shorthands --

const create = (name: string, sha: string) => Effect.flatMap(GitBranch, (svc) => svc.create(name, sha));

const exists = (name: string) => Effect.flatMap(GitBranch, (svc) => svc.exists(name));

const del = (name: string) => Effect.flatMap(GitBranch, (svc) => svc.delete(name));

const getSha = (name: string) => Effect.flatMap(GitBranch, (svc) => svc.getSha(name));

const reset = (name: string, sha: string) => Effect.flatMap(GitBranch, (svc) => svc.reset(name, sha));

describe("GitBranch", () => {
	describe("create", () => {
		it.effect("adds a branch to the map", () =>
			Effect.gen(function* () {
				const state = GitBranchTest.empty();
				yield* run(state, create("feature/new", "abc123"));
				expect(state.branches.get("feature/new")).toBe("abc123");
			}),
		);
	});

	describe("exists", () => {
		it.effect("returns true for existing branch", () =>
			Effect.gen(function* () {
				const state = GitBranchTest.empty();
				state.branches.set("main", "sha1");
				const result = yield* run(state, exists("main"));
				expect(result).toBe(true);
			}),
		);

		it.effect("returns false for missing branch", () =>
			Effect.gen(function* () {
				const state = GitBranchTest.empty();
				const result = yield* run(state, exists("missing"));
				expect(result).toBe(false);
			}),
		);
	});

	describe("delete", () => {
		it.effect("removes a branch from the map", () =>
			Effect.gen(function* () {
				const state = GitBranchTest.empty();
				state.branches.set("feature/old", "sha1");
				yield* run(state, del("feature/old"));
				expect(state.branches.has("feature/old")).toBe(false);
			}),
		);
	});

	describe("getSha", () => {
		it.effect("returns the SHA for an existing branch", () =>
			Effect.gen(function* () {
				const state = GitBranchTest.empty();
				state.branches.set("main", "abc123");
				const sha = yield* run(state, getSha("main"));
				expect(sha).toBe("abc123");
			}),
		);

		it.effect("fails for a missing branch", () =>
			Effect.gen(function* () {
				const state = GitBranchTest.empty();
				const exit = yield* runExit(state, getSha("missing"));
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("reset", () => {
		it.effect("updates the SHA of an existing branch", () =>
			Effect.gen(function* () {
				const state = GitBranchTest.empty();
				state.branches.set("main", "old-sha");
				yield* run(state, reset("main", "new-sha"));
				expect(state.branches.get("main")).toBe("new-sha");
			}),
		);
	});

	describe("GitBranchError", () => {
		it("is a tagged error with correct fields", () => {
			const error = new GitBranchError({
				branch: "feature/test",
				operation: "create",
				reason: "ref already exists",
			});
			expect(error._tag).toBe("GitBranchError");
			expect(error.branch).toBe("feature/test");
			expect(error.operation).toBe("create");
			expect(error.reason).toBe("ref already exists");
		});
	});
});

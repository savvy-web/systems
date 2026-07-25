import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { PullRequestCommentError } from "../../src/errors/PullRequestCommentError.js";
import type { PullRequestCommentTestState } from "../../src/layers/PullRequestCommentTest.js";
import { PullRequestCommentTest } from "../../src/layers/PullRequestCommentTest.js";
import { PullRequestComment } from "../../src/services/PullRequestComment.js";

// -- Shared provide helper --

const provide = <A, E>(state: PullRequestCommentTestState, effect: Effect.Effect<A, E, PullRequestComment>) =>
	Effect.provide(effect, PullRequestCommentTest.layer(state));

const run = <A, E>(state: PullRequestCommentTestState, effect: Effect.Effect<A, E, PullRequestComment>) =>
	provide(state, effect);

// -- Service method shorthands --

const create = (prNumber: number, body: string) =>
	Effect.flatMap(PullRequestComment, (svc) => svc.create(prNumber, body));

const upsert = (prNumber: number, markerKey: string, body: string) =>
	Effect.flatMap(PullRequestComment, (svc) => svc.upsert(prNumber, markerKey, body));

const find = (prNumber: number, markerKey: string) =>
	Effect.flatMap(PullRequestComment, (svc) => svc.find(prNumber, markerKey));

const del = (prNumber: number, commentId: number) =>
	Effect.flatMap(PullRequestComment, (svc) => svc.delete(prNumber, commentId));

describe("PullRequestComment", () => {
	describe("create", () => {
		it.effect("creates a comment and returns the ID", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const id = yield* run(state, create(42, "Hello PR!"));
				expect(id).toBe(1);
			}),
		);

		it.effect("stores the comment in state", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				yield* run(state, create(42, "Hello PR!"));
				const prComments = state.comments.get(42);
				expect(prComments).toHaveLength(1);
				expect(prComments?.[0]?.body).toBe("Hello PR!");
			}),
		);

		it.effect("assigns incrementing IDs", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const program = Effect.gen(function* () {
					const svc = yield* PullRequestComment;
					const id1 = yield* svc.create(42, "First");
					const id2 = yield* svc.create(42, "Second");
					return [id1, id2];
				});
				const ids = yield* run(state, program);
				expect(ids).toEqual([1, 2]);
			}),
		);

		it.effect("stores comments per PR number", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const program = Effect.gen(function* () {
					const svc = yield* PullRequestComment;
					yield* svc.create(1, "Comment on PR 1");
					yield* svc.create(2, "Comment on PR 2");
				});
				yield* run(state, program);
				expect(state.comments.get(1)).toHaveLength(1);
				expect(state.comments.get(2)).toHaveLength(1);
			}),
		);
	});

	describe("upsert", () => {
		it.effect("creates a new comment when no marker found", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const id = yield* run(state, upsert(42, "build-report", "Build passed"));
				expect(id).toBe(1);
				const prComments = state.comments.get(42);
				expect(prComments).toHaveLength(1);
				expect(prComments?.[0]?.body).toContain("<!-- savvy-web:build-report -->");
				expect(prComments?.[0]?.body).toContain("Build passed");
			}),
		);

		it.effect("updates existing comment when marker found", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const program = Effect.gen(function* () {
					const svc = yield* PullRequestComment;
					const id1 = yield* svc.upsert(42, "build-report", "Build passed v1");
					const id2 = yield* svc.upsert(42, "build-report", "Build passed v2");
					return [id1, id2];
				});
				const ids = yield* run(state, program);

				// Same comment ID returned
				expect(ids[0]).toBe(ids[1]);

				// Only one comment exists
				const prComments = state.comments.get(42);
				expect(prComments).toHaveLength(1);

				// Body is updated
				expect(prComments?.[0]?.body).toContain("Build passed v2");
				expect(prComments?.[0]?.body).not.toContain("Build passed v1");
			}),
		);

		it.effect("prepends marker to body", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				yield* run(state, upsert(42, "my-key", "Content"));
				const prComments = state.comments.get(42);
				expect(prComments?.[0]?.body).toBe("<!-- savvy-web:my-key -->\nContent");
			}),
		);

		it.effect("handles different marker keys independently", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const program = Effect.gen(function* () {
					const svc = yield* PullRequestComment;
					yield* svc.upsert(42, "key-a", "Content A");
					yield* svc.upsert(42, "key-b", "Content B");
				});
				yield* run(state, program);

				const prComments = state.comments.get(42);
				expect(prComments).toHaveLength(2);
			}),
		);
	});

	describe("find", () => {
		it.effect("returns Some when marker found", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const program = Effect.gen(function* () {
					const svc = yield* PullRequestComment;
					yield* svc.upsert(42, "build-report", "Build passed");
					return yield* svc.find(42, "build-report");
				});
				const result = yield* run(state, program);
				expect(Option.isSome(result)).toBe(true);
				if (Option.isSome(result)) {
					expect(result.value.body).toContain("Build passed");
					expect(result.value.id).toBe(1);
				}
			}),
		);

		it.effect("returns None when marker not found", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const result = yield* run(state, find(42, "nonexistent"));
				expect(Option.isNone(result)).toBe(true);
			}),
		);

		it.effect("returns None when PR has no comments", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const result = yield* run(state, find(99, "some-key"));
				expect(Option.isNone(result)).toBe(true);
			}),
		);

		it.effect("finds correct comment among multiple", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const program = Effect.gen(function* () {
					const svc = yield* PullRequestComment;
					yield* svc.upsert(42, "key-a", "Content A");
					yield* svc.upsert(42, "key-b", "Content B");
					return yield* svc.find(42, "key-b");
				});
				const result = yield* run(state, program);
				expect(Option.isSome(result)).toBe(true);
				if (Option.isSome(result)) {
					expect(result.value.body).toContain("Content B");
				}
			}),
		);
	});

	describe("delete", () => {
		it.effect("removes comment from state", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const program = Effect.gen(function* () {
					const svc = yield* PullRequestComment;
					const id = yield* svc.create(42, "To be deleted");
					yield* svc.delete(42, id);
				});
				yield* run(state, program);
				const prComments = state.comments.get(42) ?? [];
				expect(prComments).toHaveLength(0);
			}),
		);

		it.effect("does not throw when comment ID does not exist", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				yield* run(state, del(42, 999));
				// No error thrown
			}),
		);

		it.effect("only removes the targeted comment", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				const program = Effect.gen(function* () {
					const svc = yield* PullRequestComment;
					yield* svc.create(42, "Keep this");
					const id2 = yield* svc.create(42, "Delete this");
					yield* svc.delete(42, id2);
				});
				yield* run(state, program);
				const prComments = state.comments.get(42) ?? [];
				expect(prComments).toHaveLength(1);
				expect(prComments[0]?.body).toBe("Keep this");
			}),
		);
	});

	describe("marker format", () => {
		it.effect("uses hidden HTML comment format", () =>
			Effect.gen(function* () {
				const state = PullRequestCommentTest.empty();
				yield* run(state, upsert(42, "test-key", "body"));
				const prComments = state.comments.get(42);
				expect(prComments?.[0]?.body).toMatch(/^<!-- savvy-web:test-key -->\n/);
			}),
		);
	});

	describe("PullRequestCommentError", () => {
		it("is a tagged error", () => {
			const error = new PullRequestCommentError({
				prNumber: 42,
				operation: "create",
				reason: "something went wrong",
			});
			expect(error._tag).toBe("PullRequestCommentError");
			expect(error.prNumber).toBe(42);
			expect(error.operation).toBe("create");
			expect(error.reason).toBe("something went wrong");
		});
	});
});

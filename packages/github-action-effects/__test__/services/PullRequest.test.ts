import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { PullRequestError } from "../../src/errors/PullRequestError.js";
import { PullRequestTest } from "../../src/layers/PullRequestTest.js";
import { PullRequest } from "../../src/services/PullRequest.js";

const provide = <A, E>(state: ReturnType<typeof PullRequestTest.empty>, effect: Effect.Effect<A, E, PullRequest>) =>
	Effect.provide(effect, PullRequestTest.layer(state));

const run = <A, E>(state: ReturnType<typeof PullRequestTest.empty>, effect: Effect.Effect<A, E, PullRequest>) =>
	provide(state, effect);

const runExit = <A, E>(state: ReturnType<typeof PullRequestTest.empty>, effect: Effect.Effect<A, E, PullRequest>) =>
	Effect.exit(provide(state, effect));

describe("PullRequest", () => {
	describe("create", () => {
		it.effect("creates a PR and returns info", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const pr = yield* run(
					state,
					Effect.flatMap(PullRequest, (svc) =>
						svc.create({
							title: "test PR",
							body: "test body",
							head: "feature",
							base: "main",
						}),
					),
				);
				expect(pr.number).toBe(1);
				expect(pr.title).toBe("test PR");
				expect(pr.head).toBe("feature");
				expect(pr.base).toBe("main");
				expect(pr.state).toBe("open");
				expect(pr.draft).toBe(false);
				expect(pr.merged).toBe(false);
				expect(state.prs).toHaveLength(1);
			}),
		);

		it.effect("creates a draft PR", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const pr = yield* run(
					state,
					Effect.flatMap(PullRequest, (svc) =>
						svc.create({
							title: "draft PR",
							body: "wip",
							head: "feature",
							base: "main",
							draft: true,
						}),
					),
				);
				expect(pr.draft).toBe(true);
			}),
		);

		it.effect("assigns incrementing numbers", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const pr1 = yield* run(
					state,
					Effect.flatMap(PullRequest, (svc) => svc.create({ title: "PR 1", body: "", head: "a", base: "main" })),
				);
				const pr2 = yield* run(
					state,
					Effect.flatMap(PullRequest, (svc) => svc.create({ title: "PR 2", body: "", head: "b", base: "main" })),
				);
				expect(pr2.number).toBe(pr1.number + 1);
			}),
		);
	});

	describe("get", () => {
		it.effect("returns PR by number", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const pr = yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "test", body: "", head: "a", base: "main" });
						return yield* svc.get(1);
					}),
				);
				expect(pr.number).toBe(1);
				expect(pr.title).toBe("test");
			}),
		);

		it.effect("fails when PR not found", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const exit = yield* runExit(
					state,
					Effect.flatMap(PullRequest, (svc) => svc.get(999)),
				);
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("list", () => {
		it.effect("returns all PRs when no filter", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const prs = yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "PR 1", body: "", head: "a", base: "main" });
						yield* svc.create({ title: "PR 2", body: "", head: "b", base: "main" });
						return yield* svc.list();
					}),
				);
				expect(prs).toHaveLength(2);
			}),
		);

		it.effect("filters by head branch", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const prs = yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "PR 1", body: "", head: "feature-a", base: "main" });
						yield* svc.create({ title: "PR 2", body: "", head: "feature-b", base: "main" });
						return yield* svc.list({ head: "feature-a" });
					}),
				);
				expect(prs).toHaveLength(1);
				expect(prs[0].head).toBe("feature-a");
			}),
		);

		it.effect("filters by state", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const prs = yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "PR 1", body: "", head: "a", base: "main" });
						yield* svc.update(1, { state: "closed" });
						yield* svc.create({ title: "PR 2", body: "", head: "b", base: "main" });
						return yield* svc.list({ state: "open" });
					}),
				);
				expect(prs).toHaveLength(1);
				expect(prs[0].title).toBe("PR 2");
			}),
		);
	});

	describe("update", () => {
		it.effect("updates title and body", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const pr = yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "old", body: "old body", head: "a", base: "main" });
						return yield* svc.update(1, { title: "new", body: "new body" });
					}),
				);
				expect(pr.title).toBe("new");
				expect(state.prs[0].body).toBe("new body");
			}),
		);

		it.effect("closes a PR", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const pr = yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "test", body: "", head: "a", base: "main" });
						return yield* svc.update(1, { state: "closed" });
					}),
				);
				expect(pr.state).toBe("closed");
			}),
		);
	});

	describe("getOrCreate", () => {
		it.effect("creates when no matching PR exists", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const result = yield* run(
					state,
					Effect.flatMap(PullRequest, (svc) =>
						svc.getOrCreate({
							head: "feature",
							base: "main",
							title: "new PR",
							body: "body",
						}),
					),
				);
				expect(result.created).toBe(true);
				expect(result.title).toBe("new PR");
				expect(state.prs).toHaveLength(1);
			}),
		);

		it.effect("updates existing PR when found", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const result = yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "old title", body: "old", head: "feature", base: "main" });
						return yield* svc.getOrCreate({
							head: "feature",
							base: "main",
							title: "new title",
							body: "new body",
						});
					}),
				);
				expect(result.created).toBe(false);
				expect(result.number).toBe(1);
				expect(result.title).toBe("new title");
				expect(state.prs[0].body).toBe("new body");
			}),
		);
	});

	describe("merge", () => {
		it.effect("merges a PR", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "test", body: "", head: "a", base: "main" });
						yield* svc.merge(1);
					}),
				);
				expect(state.prs[0].merged).toBe(true);
				expect(state.prs[0].state).toBe("closed");
				expect(state.mergedPrs).toContain(1);
			}),
		);

		it.effect("fails when PR not found", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const exit = yield* runExit(
					state,
					Effect.flatMap(PullRequest, (svc) => svc.merge(999)),
				);
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("addLabels", () => {
		it.effect("adds labels to a PR", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "test", body: "", head: "a", base: "main" });
						yield* svc.addLabels(1, ["bug", "priority"]);
					}),
				);
				expect(state.prs[0].labels).toEqual(["bug", "priority"]);
			}),
		);

		it.effect("appends to existing labels", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "test", body: "", head: "a", base: "main" });
						yield* svc.addLabels(1, ["bug"]);
						yield* svc.addLabels(1, ["priority"]);
					}),
				);
				expect(state.prs[0].labels).toEqual(["bug", "priority"]);
			}),
		);

		it.effect("fails when PR not found", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const exit = yield* runExit(
					state,
					Effect.flatMap(PullRequest, (svc) => svc.addLabels(999, ["bug"])),
				);
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("requestReviewers", () => {
		it.effect("requests user reviewers", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "test", body: "", head: "a", base: "main" });
						yield* svc.requestReviewers(1, { reviewers: ["alice", "bob"] });
					}),
				);
				expect(state.prs[0].reviewers).toEqual(["alice", "bob"]);
			}),
		);

		it.effect("requests team reviewers", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				yield* run(
					state,
					Effect.gen(function* () {
						const svc = yield* PullRequest;
						yield* svc.create({ title: "test", body: "", head: "a", base: "main" });
						yield* svc.requestReviewers(1, { teamReviewers: ["core-team"] });
					}),
				);
				expect(state.prs[0].teamReviewers).toEqual(["core-team"]);
			}),
		);

		it.effect("fails when PR not found", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				const exit = yield* runExit(
					state,
					Effect.flatMap(PullRequest, (svc) => svc.requestReviewers(999, { reviewers: ["alice"] })),
				);
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("autoMerge via create", () => {
		it.effect("records autoMerge setting on create", () =>
			Effect.gen(function* () {
				const state = PullRequestTest.empty();
				yield* run(
					state,
					Effect.flatMap(PullRequest, (svc) =>
						svc.create({
							title: "auto",
							body: "",
							head: "a",
							base: "main",
							autoMerge: "squash",
						}),
					),
				);
				expect(state.prs[0].autoMerge).toBe("squash");
			}),
		);
	});

	describe("PullRequestError", () => {
		it("is a tagged error with correct fields", () => {
			const error = new PullRequestError({
				operation: "create",
				reason: "API rate limited",
			});
			expect(error._tag).toBe("PullRequestError");
			expect(error.operation).toBe("create");
			expect(error.reason).toBe("API rate limited");
			expect(error.prNumber).toBeUndefined();
		});

		it("includes prNumber when provided", () => {
			const error = new PullRequestError({
				operation: "merge",
				prNumber: 42,
				reason: "not mergeable",
			});
			expect(error.prNumber).toBe(42);
		});
	});
});

import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { GitHubIssueTest } from "../../src/layers/GitHubIssueTest.js";
import { GitHubIssue } from "../../src/services/GitHubIssue.js";

describe("GitHubIssue", () => {
	it.effect("lists all issues", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubIssueTest.empty();
			state.issues.set(1, { number: 1, title: "Bug", state: "open", labels: ["bug"] });
			state.issues.set(2, { number: 2, title: "Feature", state: "closed", labels: ["enhancement"] });

			const result = yield* GitHubIssue.pipe(
				Effect.flatMap((svc) => svc.list()),
				Effect.provide(layer),
			);
			expect(result).toHaveLength(2);
		}),
	);

	it.effect("filters by state", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubIssueTest.empty();
			state.issues.set(1, { number: 1, title: "Bug", state: "open", labels: [] });
			state.issues.set(2, { number: 2, title: "Feature", state: "closed", labels: [] });

			const result = yield* GitHubIssue.pipe(
				Effect.flatMap((svc) => svc.list({ state: "open" })),
				Effect.provide(layer),
			);
			expect(result).toHaveLength(1);
			expect(result[0]?.state).toBe("open");
		}),
	);

	it.effect("filters by labels", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubIssueTest.empty();
			state.issues.set(1, { number: 1, title: "Bug", state: "open", labels: ["bug"] });
			state.issues.set(2, { number: 2, title: "Feature", state: "open", labels: ["enhancement"] });
			state.issues.set(3, { number: 3, title: "Docs", state: "open", labels: ["docs"] });

			const result = yield* GitHubIssue.pipe(
				Effect.flatMap((svc) => svc.list({ labels: ["bug", "docs"] })),
				Effect.provide(layer),
			);
			expect(result).toHaveLength(2);
		}),
	);

	it.effect("closes an issue", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubIssueTest.empty();
			state.issues.set(1, { number: 1, title: "Bug", state: "open", labels: [] });

			yield* GitHubIssue.pipe(
				Effect.flatMap((svc) => svc.close(1, "completed")),
				Effect.provide(layer),
			);
			expect(state.closeCalls).toHaveLength(1);
			expect(state.closeCalls[0]).toEqual({ issueNumber: 1, reason: "completed" });
			expect(state.issues.get(1)?.state).toBe("closed");
		}),
	);

	it.effect("fails to close unknown issue", () =>
		Effect.gen(function* () {
			const { layer } = GitHubIssueTest.empty();
			const exit = yield* Effect.exit(
				GitHubIssue.pipe(
					Effect.flatMap((svc) => svc.close(999)),
					Effect.provide(layer),
				),
			);
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("adds a comment", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubIssueTest.empty();
			state.issues.set(1, { number: 1, title: "Bug", state: "open", labels: [] });

			const result = yield* GitHubIssue.pipe(
				Effect.flatMap((svc) => svc.comment(1, "This is fixed")),
				Effect.provide(layer),
			);
			expect(result.id).toBe(1001);
			expect(state.comments).toHaveLength(1);
			expect(state.comments[0]).toEqual({ issueNumber: 1, body: "This is fixed" });
		}),
	);

	it.effect("gets linked issues for a PR", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubIssueTest.empty();
			state.linkedIssues.set(42, [
				{ number: 1, title: "Bug fix" },
				{ number: 2, title: "Feature" },
			]);

			const result = yield* GitHubIssue.pipe(
				Effect.flatMap((svc) => svc.getLinkedIssues(42)),
				Effect.provide(layer),
			);
			expect(result).toHaveLength(2);
			expect(result[0]?.number).toBe(1);
		}),
	);

	it.effect("returns empty for PR with no linked issues", () =>
		Effect.gen(function* () {
			const { layer } = GitHubIssueTest.empty();
			const result = yield* GitHubIssue.pipe(
				Effect.flatMap((svc) => svc.getLinkedIssues(99)),
				Effect.provide(layer),
			);
			expect(result).toHaveLength(0);
		}),
	);
});

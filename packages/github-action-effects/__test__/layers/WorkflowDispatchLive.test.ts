import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Duration, Effect, Exit, Fiber, Layer, Stream } from "effect";
import { TestClock } from "effect/testing";
import { GitHubClientError } from "../../src/errors/GitHubClientError.js";
import { WorkflowDispatchLive } from "../../src/layers/WorkflowDispatchLive.js";
import { GitHubClient } from "../../src/services/GitHubClient.js";
import { WorkflowDispatch } from "../../src/services/WorkflowDispatch.js";

const mockCreateWorkflowDispatch = vi.fn();
const mockListWorkflowRuns = vi.fn();
const mockGetWorkflowRun = vi.fn();

const mockClient: typeof GitHubClient.Service = {
	rest: <T>(_operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
		Effect.tryPromise({
			try: () =>
				fn({
					rest: {
						actions: {
							createWorkflowDispatch: mockCreateWorkflowDispatch,
							listWorkflowRuns: mockListWorkflowRuns,
							getWorkflowRun: mockGetWorkflowRun,
						},
					},
				}),
			catch: (e) =>
				new GitHubClientError({
					operation: _operation,
					status: undefined,
					reason: e instanceof Error ? e.message : String(e),
					retryable: false,
					retryAfterMs: undefined,
				}),
		}).pipe(Effect.map((r) => r.data)),
	graphql: () => Effect.die("not used"),
	paginate: () => Effect.die("not used"),
	paginateStream: () => Stream.die("not used"),
	repo: Effect.succeed({ owner: "test-owner", repo: "test-repo" }),
};

const testLayer = Layer.provide(WorkflowDispatchLive, Layer.succeed(GitHubClient, mockClient));

const run = <A, E>(effect: Effect.Effect<A, E, WorkflowDispatch>) => Effect.provide(effect, testLayer);

const runExit = <A, E>(effect: Effect.Effect<A, E, WorkflowDispatch>) => Effect.exit(Effect.provide(effect, testLayer));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("WorkflowDispatchLive", () => {
	describe("dispatch", () => {
		it.effect("calls actions.createWorkflowDispatch", () =>
			Effect.gen(function* () {
				mockCreateWorkflowDispatch.mockResolvedValue({ data: {} });
				yield* run(Effect.flatMap(WorkflowDispatch, (svc) => svc.dispatch("deploy.yml", "main")));
				expect(mockCreateWorkflowDispatch).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						workflow_id: "deploy.yml",
						ref: "main",
					}),
				);
			}),
		);

		it.effect("passes inputs when provided", () =>
			Effect.gen(function* () {
				mockCreateWorkflowDispatch.mockResolvedValue({ data: {} });
				yield* run(Effect.flatMap(WorkflowDispatch, (svc) => svc.dispatch("deploy.yml", "main", { env: "staging" })));
				expect(mockCreateWorkflowDispatch).toHaveBeenCalledWith(
					expect.objectContaining({
						inputs: { env: "staging" },
					}),
				);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockCreateWorkflowDispatch.mockRejectedValue(new Error("api error"));
				const exit = yield* runExit(Effect.flatMap(WorkflowDispatch, (svc) => svc.dispatch("deploy.yml", "main")));
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("getRunStatus", () => {
		it.effect("returns status and conclusion", () =>
			Effect.gen(function* () {
				mockGetWorkflowRun.mockResolvedValue({
					data: { status: "completed", conclusion: "success" },
				});
				const result = yield* run(Effect.flatMap(WorkflowDispatch, (svc) => svc.getRunStatus(123)));
				expect(result).toEqual({ status: "completed", conclusion: "success" });
				expect(mockGetWorkflowRun).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						run_id: 123,
					}),
				);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockGetWorkflowRun.mockRejectedValue(new Error("not found"));
				const exit = yield* runExit(Effect.flatMap(WorkflowDispatch, (svc) => svc.getRunStatus(999)));
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("dispatchAndWait", () => {
		const futureDate = "2099-01-01T00:00:00.000Z";

		it.effect("dispatches and returns conclusion on first poll", () =>
			Effect.gen(function* () {
				mockCreateWorkflowDispatch.mockResolvedValue({ data: {} });
				mockListWorkflowRuns.mockImplementation(() =>
					Promise.resolve({
						data: {
							workflow_runs: [
								{
									id: 1,
									status: "completed",
									conclusion: "success",
									created_at: futureDate,
								},
							],
						},
					}),
				);
				const result = yield* run(
					Effect.flatMap(WorkflowDispatch, (svc) =>
						svc.dispatchAndWait("deploy.yml", "main", undefined, {
							intervalMs: 1,
							timeoutMs: 1000,
						}),
					),
				);
				expect(result).toBe("success");
				expect(mockCreateWorkflowDispatch).toHaveBeenCalledTimes(1);
				expect(mockListWorkflowRuns).toHaveBeenCalledTimes(1);
			}),
		);

		// `it.live` for these two: they poll on a real clock with `intervalMs: 1` /
		// `timeoutMs: 10` and never advance a TestClock, so under `it.effect` the first
		// poll interval never elapses (verified: "Test timed out in 5000ms"). The
		// `dispatchAndWait (TestClock)` describe below covers the same behaviour properly
		// under a driven clock; these remain as the real-timer variants.
		it.live("retries until run completes", () =>
			Effect.gen(function* () {
				mockCreateWorkflowDispatch.mockResolvedValue({ data: {} });

				let callCount = 0;
				mockListWorkflowRuns.mockImplementation(() => {
					callCount++;
					if (callCount < 3) {
						return Promise.resolve({
							data: {
								workflow_runs: [
									{
										id: 1,
										status: "in_progress",
										conclusion: null,
										created_at: futureDate,
									},
								],
							},
						});
					}
					return Promise.resolve({
						data: {
							workflow_runs: [
								{
									id: 1,
									status: "completed",
									conclusion: "failure",
									created_at: futureDate,
								},
							],
						},
					});
				});

				const result = yield* run(
					Effect.flatMap(WorkflowDispatch, (svc) =>
						svc.dispatchAndWait("deploy.yml", "main", undefined, {
							intervalMs: 1,
							timeoutMs: 10_000,
						}),
					),
				);
				expect(result).toBe("failure");
				expect(callCount).toBeGreaterThanOrEqual(3);
			}),
		);

		it.live("times out when workflow never completes", () =>
			Effect.gen(function* () {
				mockCreateWorkflowDispatch.mockResolvedValue({ data: {} });
				mockListWorkflowRuns.mockImplementation(() =>
					Promise.resolve({
						data: {
							workflow_runs: [
								{
									id: 1,
									status: "in_progress",
									conclusion: null,
									created_at: futureDate,
								},
							],
						},
					}),
				);

				const exit = yield* runExit(
					Effect.flatMap(WorkflowDispatch, (svc) =>
						svc.dispatchAndWait("deploy.yml", "main", undefined, {
							intervalMs: 1,
							timeoutMs: 10,
						}),
					),
				);
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("dispatchAndWait (TestClock)", () => {
		const futureDate = "2099-01-01T00:00:00.000Z";

		it.effect("resolves the conclusion after pending polls", () =>
			Effect.gen(function* () {
				mockCreateWorkflowDispatch.mockResolvedValue({ data: {} });
				let callCount = 0;
				mockListWorkflowRuns.mockImplementation(() => {
					callCount++;
					const run =
						callCount < 3
							? { id: 1, status: "in_progress", conclusion: null, created_at: futureDate }
							: { id: 1, status: "completed", conclusion: "success", created_at: futureDate };
					return Promise.resolve({ data: { workflow_runs: [run] } });
				});

				const exit = yield* Effect.gen(function* () {
					const fiber = yield* Effect.forkChild(
						Effect.provide(
							Effect.flatMap(WorkflowDispatch, (svc) =>
								svc.dispatchAndWait("deploy.yml", "main", undefined, { intervalMs: 10_000, timeoutMs: 300_000 }),
							),
							testLayer,
						),
					);
					// Two pending polls are spaced 10s apart.
					yield* TestClock.adjust(Duration.seconds(30));
					return yield* Fiber.join(fiber);
				}).pipe(Effect.exit);

				expect(exit._tag).toBe("Success");
				if (Exit.isSuccess(exit)) {
					expect(exit.value).toBe("success");
				}
				expect(callCount).toBeGreaterThanOrEqual(3);
			}),
		);

		it.effect("times out after the configured timeout", () =>
			Effect.gen(function* () {
				mockCreateWorkflowDispatch.mockResolvedValue({ data: {} });
				mockListWorkflowRuns.mockImplementation(() =>
					Promise.resolve({
						data: { workflow_runs: [{ id: 1, status: "in_progress", conclusion: null, created_at: futureDate }] },
					}),
				);

				const exit = yield* Effect.gen(function* () {
					const fiber = yield* Effect.forkChild(
						Effect.provide(
							Effect.flatMap(WorkflowDispatch, (svc) =>
								svc.dispatchAndWait("deploy.yml", "main", undefined, { intervalMs: 10_000, timeoutMs: 30_000 }),
							),
							testLayer,
						),
					);
					// Advance well past the timeout budget.
					yield* TestClock.adjust(Duration.seconds(120));
					return yield* Fiber.join(fiber);
				}).pipe(Effect.exit);

				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					const cause = JSON.stringify(exit.cause);
					expect(cause).toContain("Timed out after");
					expect(cause).toContain('"operation":"poll"');
				}
			}),
		);
	});
});

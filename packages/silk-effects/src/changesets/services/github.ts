/**
 * GitHub service for fetching commit metadata.
 *
 * Defines the {@link GitHubService} Effect service tag, the
 * {@link GitHubLive | production layer} backed by `\@changesets/get-github-info`,
 * and the {@link makeGitHubTest} helper for constructing deterministic test
 * layers.
 *
 * @remarks
 * The GitHub service is consumed by the changelog formatters to resolve
 * commit hashes into pull-request numbers, author usernames, and link URLs.
 * In production, {@link GitHubLive} calls the GitHub REST API via the
 * vendored `getGitHubInfo` wrapper. In tests, {@link makeGitHubTest}
 * returns canned responses from a `Map` keyed by commit hash.
 *
 * @see {@link GitHubService} for the Effect service tag
 * @see {@link GitHubServiceShape} for the service interface
 * @see {@link GitHubLive} for the production layer
 * @see {@link makeGitHubTest} for constructing test layers
 */

import { Context, Effect, Layer } from "effect";

import { GitHubApiError } from "../errors.js";
import type { GitHubCommitInfo } from "../vendor/github-info.js";
import { getGitHubInfo } from "../vendor/github-info.js";

/**
 * Service interface for GitHub API operations.
 *
 * Describes the single `getInfo` operation that resolves a commit hash to
 * its associated GitHub metadata (pull-request number, author, and links).
 *
 * @remarks
 * The `getInfo` method may fail with a {@link GitHubApiError} when the
 * GitHub API is unreachable or the commit is not found. Callers should
 * handle this error channel — the changelog formatters recover gracefully
 * by omitting attribution when the call fails.
 *
 * @public
 */
export interface GitHubServiceShape {
	/**
	 * Fetch commit metadata from the GitHub API.
	 *
	 * @param params - The commit hash and repository identifier. Must include
	 * `commit` (full SHA-1 hash) and `repo` (in `owner/repo` format).
	 * @returns An `Effect` that resolves to {@link GitHubCommitInfo} or fails with {@link GitHubApiError}
	 */
	readonly getInfo: (params: { commit: string; repo: string }) => Effect.Effect<GitHubCommitInfo, GitHubApiError>;
}

const _tag = Context.Tag("GitHubService");

/**
 * Base class for GitHubService.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Context.Tag creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const GitHubServiceBase = _tag<GitHubService, GitHubServiceShape>();

/**
 * Effect service tag for GitHub API operations.
 *
 * Provides dependency-injected access to GitHub commit metadata lookups.
 * Use `yield* GitHubService` inside an `Effect.gen` block to obtain the
 * service instance.
 *
 * @remarks
 * This tag follows the standard Effect `Context.Tag` pattern. Two layers
 * are provided out of the box:
 *
 * - {@link GitHubLive} — production layer backed by the GitHub REST API
 * - {@link makeGitHubTest} — factory for deterministic test layers
 *
 * @example
 * ```typescript
 * import { Effect, Layer } from "effect";
 * import { GitHubService, GitHubLive } from "\@savvy-web/changesets";
 *
 * const program = Effect.gen(function* () {
 *   const github = yield* GitHubService;
 *   const info = yield* github.getInfo({
 *     commit: "abc1234567890",
 *     repo: "savvy-web/changesets",
 *   });
 *   console.log(info.user, info.pull, info.links);
 * });
 *
 * // Provide the live layer and run
 * Effect.runPromise(program.pipe(Effect.provide(GitHubLive)));
 * ```
 *
 * @example Creating a test layer with canned responses
 * ```typescript
 * import { Effect } from "effect";
 * import type { GitHubCommitInfo } from "\@savvy-web/changesets";
 * import { GitHubService, makeGitHubTest } from "\@savvy-web/changesets";
 *
 * const testResponses = new Map<string, GitHubCommitInfo>([
 *   ["abc1234", { user: "octocat", pull: 42, links: { pull: "#42", user: "\@octocat" } }],
 * ]);
 *
 * const TestLayer = makeGitHubTest(testResponses);
 *
 * const program = Effect.gen(function* () {
 *   const github = yield* GitHubService;
 *   return yield* github.getInfo({ commit: "abc1234", repo: "owner/repo" });
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 * ```
 *
 * @see {@link GitHubServiceShape} for the service interface
 * @see {@link GitHubLive} for the production layer
 * @see {@link makeGitHubTest} for creating test layers
 * @see {@link GitHubServiceBase} for the api-extractor base class
 *
 * @public
 */
export class GitHubService extends GitHubServiceBase {}

/**
 * Production layer for {@link GitHubService}.
 *
 * Delegates to `\@changesets/get-github-info` to fetch commit metadata
 * from the GitHub REST API. Requires a `GITHUB_TOKEN` environment variable
 * to be set for authenticated requests.
 *
 * @remarks
 * This layer is used by the `\@savvy-web/changesets/changelog` entry point
 * to resolve commit hashes into PR numbers and author attribution. It is
 * composed with {@link MarkdownLive} in the changelog formatter's
 * `MainLayer`.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { GitHubService, GitHubLive } from "\@savvy-web/changesets";
 *
 * const program = Effect.gen(function* () {
 *   const github = yield* GitHubService;
 *   return yield* github.getInfo({ commit: "abc1234", repo: "owner/repo" });
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(GitHubLive)));
 * ```
 *
 * @public
 */
export const GitHubLive = Layer.succeed(GitHubService, {
	getInfo: getGitHubInfo,
});

/**
 * Create a test layer for {@link GitHubService} with pre-configured responses.
 *
 * Returns a `Layer` that resolves commit hashes from the provided `Map`.
 * Lookups for commits not present in the map fail with a
 * {@link GitHubApiError}.
 *
 * @remarks
 * This helper is the recommended way to test code that depends on
 * `GitHubService` without making real API calls. Provide the layer
 * via `Effect.provide` in your test setup.
 *
 * @param responses - A `Map` of full commit hash to {@link GitHubCommitInfo} objects
 * @returns A `Layer` providing the {@link GitHubService} with deterministic responses
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { GitHubCommitInfo } from "\@savvy-web/changesets";
 * import { GitHubService, makeGitHubTest } from "\@savvy-web/changesets";
 *
 * const responses = new Map<string, GitHubCommitInfo>([
 *   ["abc1234", { user: "octocat", pull: 42, links: { pull: "#42", user: "\@octocat" } }],
 * ]);
 *
 * const TestGitHub = makeGitHubTest(responses);
 *
 * const program = Effect.gen(function* () {
 *   const github = yield* GitHubService;
 *   return yield* github.getInfo({ commit: "abc1234", repo: "owner/repo" });
 * });
 *
 * // In a Vitest test:
 * const result = await Effect.runPromise(program.pipe(Effect.provide(TestGitHub)));
 * // result.user === "octocat"
 * ```
 *
 * @public
 */
export function makeGitHubTest(responses: Map<string, GitHubCommitInfo>): Layer.Layer<GitHubService> {
	return Layer.succeed(GitHubService, {
		getInfo: (params) => {
			const info = responses.get(params.commit);
			if (info) {
				return Effect.succeed(info);
			}
			return Effect.fail(
				new GitHubApiError({
					operation: "getInfo",
					reason: `No mock response for commit ${params.commit}`,
				}),
			);
		},
	});
}

import type { Octokit } from "@octokit/rest";
import type { Effect, Stream } from "effect";
import { Context } from "effect";
import type { GitHubClientError } from "../errors/GitHubClientError.js";

/**
 * The concrete Octokit instance type the {@link GitHubClient} layers construct
 * and hand to `rest` / `paginate` / `paginateStream` callbacks: `@octokit/rest`'s
 * `Octokit` with the rest-endpoint-methods and paginate plugins applied.
 *
 * Annotate the callback parameter with this type to make raw REST calls
 * type-safe without hand-rolled cast interfaces:
 *
 * ```ts
 * client.rest("repos.get", (octokit: GitHubOctokit) =>
 *   octokit.rest.repos.get({ owner, repo }),
 * );
 * ```
 *
 * @public
 */
export type GitHubOctokit = Octokit;

// The three octokit-callback parameters below are typed `any` rather than
// `GitHubOctokit` deliberately: the Live and Test layer implementations (and
// external test doubles) still annotate the parameter as `unknown`, and
// TypeScript's contravariant parameter checking would reject them against a
// narrower type. `any` is the one type that keeps those implementations
// assignable while letting callers annotate the parameter as `GitHubOctokit`
// (an annotation the previous `unknown` typing rejected). Tightening the
// parameter to `GitHubOctokit` outright is deferred to the per-layer cleanup
// pass that retypes the implementations.

/**
 * Service shape for {@link GitHubClient}.
 *
 * @public
 */
export interface GitHubClientShape {
	/**
	 * Execute a REST API call via callback.
	 * The callback receives the live Octokit instance; annotate the parameter
	 * as `GitHubOctokit` for type-safe access to the full Octokit
	 * surface.
	 */
	readonly rest: <T>(
		operation: string,
		// biome-ignore lint/suspicious/noExplicitAny: impl-compat — see note above
		fn: (octokit: any) => Promise<{ data: T }>,
	) => Effect.Effect<T, GitHubClientError>;

	/**
	 * Execute a GraphQL query. Returns the response data.
	 */
	readonly graphql: <T>(query: string, variables?: Record<string, unknown>) => Effect.Effect<T, GitHubClientError>;

	/**
	 * Paginate a REST API call, collecting all results across pages.
	 * Annotate the callback's first parameter as `GitHubOctokit` for
	 * type-safe access.
	 */
	readonly paginate: <T>(
		operation: string,
		// biome-ignore lint/suspicious/noExplicitAny: impl-compat — see note above
		fn: (octokit: any, page: number, perPage: number) => Promise<{ data: T[] }>,
		options?: { perPage?: number; maxPages?: number },
	) => Effect.Effect<Array<T>, GitHubClientError>;

	/**
	 * Paginate a REST API call as a Stream, one page's worth of items at a
	 * time. Lets consumers `Stream.takeWhile` / `Stream.take` and stop early
	 * without fetching or buffering the remaining pages. The eager `paginate`
	 * collects all pages; prefer `paginateStream` for large or
	 * early-terminating scans. Annotate the callback's first parameter as
	 * `GitHubOctokit` for type-safe access.
	 */
	readonly paginateStream: <T>(
		operation: string,
		// biome-ignore lint/suspicious/noExplicitAny: impl-compat — see note above
		fn: (octokit: any, page: number, perPage: number) => Promise<{ data: T[] }>,
		options?: { perPage?: number; maxPages?: number },
	) => Stream.Stream<T, GitHubClientError>;

	/**
	 * Get the repository context (owner and repo name).
	 * Derived from GITHUB_REPOSITORY environment variable.
	 */
	readonly repo: Effect.Effect<{ owner: string; repo: string }, GitHubClientError>;
}

/**
 * Service for GitHub API operations via Octokit.
 *
 * @public
 */
export class GitHubClient extends Context.Service<GitHubClient, GitHubClientShape>()(
	"github-action-effects/GitHubClient",
) {}

/**
 * Effect wrapper around `\@changesets/get-github-info`.
 *
 * @remarks
 * Bridges the `\@changesets/get-github-info` package (which returns
 * promises) into the Effect ecosystem. The {@link getGitHubInfo}
 * function wraps the upstream `getInfo()` call in `Effect.tryPromise`,
 * mapping failures to {@link GitHubApiError}.
 *
 * The {@link GitHubCommitInfo} type is the only item from this module
 * that is part of the public API (re-exported from the package root).
 *
 * @see {@link GitHubService} for the Effect service layer that uses
 *   this function
 *
 * @internal
 */

import { getInfo } from "@changesets/get-github-info";
import { Effect } from "effect";

import { GitHubApiError } from "../errors.js";

/**
 * Structured result from the GitHub commit info API.
 *
 * @remarks
 * Represents the data returned by `\@changesets/get-github-info` for a
 * single commit. Includes the commit author's GitHub username, the
 * associated pull request number (if any), and pre-formatted markdown
 * links for use in changelog entries.
 *
 * @example
 * ```typescript
 * import type { GitHubCommitInfo } from "\@savvy-web/changesets";
 *
 * const info: GitHubCommitInfo = {
 *   user: "octocat",
 *   pull: 42,
 *   links: {
 *     commit: "[`abc1234`](https://github.com/owner/repo/commit/abc1234)",
 *     pull: "[#42](https://github.com/owner/repo/pull/42)",
 *     user: "[\@octocat](https://github.com/octocat)",
 *   },
 * };
 * ```
 *
 * @public
 */
export interface GitHubCommitInfo {
	/** The GitHub username of the commit author (null if unknown). */
	user: string | null;
	/** The pull request number associated with this commit (null if none). */
	pull: number | null;
	/** Markdown-formatted links for the commit, PR, and user. */
	links: {
		/** Link to the commit on GitHub. */
		commit: string;
		/** Link to the associated pull request (null if none). */
		pull: string | null;
		/** Link to the author's GitHub profile (null if unknown). */
		user: string | null;
	};
}

/**
 * Fetch GitHub info for a commit, wrapped in Effect.
 *
 * @remarks
 * Calls the upstream `getInfo()` from `\@changesets/get-github-info`
 * within `Effect.tryPromise`. Any thrown error is caught and mapped
 * to a {@link GitHubApiError} with the operation set to `"getInfo"`.
 *
 * Requires a `GITHUB_TOKEN` environment variable to be set for
 * authenticated API access (the upstream library reads it directly).
 *
 * @param params - The commit hash and repo in `owner/repo` format
 * @returns An Effect that resolves to {@link GitHubCommitInfo} or fails
 *   with {@link GitHubApiError}
 *
 * @internal
 */
export function getGitHubInfo(params: {
	commit: string;
	repo: string;
}): Effect.Effect<GitHubCommitInfo, GitHubApiError> {
	return Effect.tryPromise({
		try: () => getInfo({ commit: params.commit, repo: params.repo }),
		/* v8 ignore next 5 -- error mapping tested via GitHubService test layer */
		catch: (error) =>
			new GitHubApiError({
				operation: "getInfo",
				reason: error instanceof Error ? error.message : String(error),
			}),
	});
}

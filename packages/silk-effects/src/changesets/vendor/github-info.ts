/**
 * The commit-info lookup behind {@link GitHubService}, over
 * `\@effected/github`'s `ChangelogInfo`.
 *
 * @remarks
 * `ChangelogInfo.commit(sha)` is the kit's `\@changesets/get-github-info`: the
 * same GraphQL query and the same markdown links, with the token and server
 * taken from the `GitHubClient` its layer is built over and the repository
 * from `Repo`. Nothing here reads the environment — the host that runs the
 * engine supplies the client. {@link getGitHubInfo} provides the `Repo` per
 * call from the changelog options' `owner/repo` and adapts the kit's
 * `Option`-valued result to the legacy {@link GitHubCommitInfo} shape.
 *
 * The {@link GitHubCommitInfo} type is the only item from this module
 * that is part of the public API (re-exported from the package root).
 *
 * @see {@link GitHubService} for the Effect service layer that uses
 *   this function
 *
 * @internal
 */

import type { GitHubGraphQLError, InvalidChangelogRefError } from "@effected/github";
import { ChangelogInfo, Repo, RepoRef } from "@effected/github";
import { Effect, Option } from "effect";

import { GitHubApiError } from "../errors.js";

/**
 * Structured result from the GitHub commit info API.
 *
 * @remarks
 * Represents what `\@effected/github`'s `ChangelogInfo.commit` answers for a
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

/** The `statusCode` a GraphQL failure kind stands for, where it names one. */
const statusOf = (error: GitHubGraphQLError): number | undefined => {
	switch (error.kind) {
		case "rateLimited":
			return 429;
		case "unauthorized":
			return 401;
		case "notFound":
			return 404;
		default:
			return undefined;
	}
};

const apiError = (reason: string, statusCode?: number): GitHubApiError =>
	new GitHubApiError({
		operation: "getCommitInfo",
		reason,
		...(statusCode === undefined ? {} : { statusCode }),
	});

/**
 * Fetch GitHub info for a commit.
 *
 * @remarks
 * Looks the commit up through `ChangelogInfo.commit` against the `owner/repo`
 * in `params.repo` and adapts the result to the legacy
 * {@link GitHubCommitInfo} shape. A commit the repository does not have
 * (`Option.none()`), a malformed repo slug or sha, and every API failure all
 * land on the same {@link GitHubApiError} channel with `operation` set to
 * `"getCommitInfo"`, so callers keep one recovery path.
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
}): Effect.Effect<GitHubCommitInfo, GitHubApiError, ChangelogInfo> {
	return Effect.gen(function* () {
		const ref = yield* RepoRef.parse(params.repo).pipe(Effect.mapError((error) => apiError(error.message)));
		const info = yield* ChangelogInfo;
		const found = yield* info.commit(params.commit).pipe(
			Repo.provide(ref),
			Effect.mapError((error: GitHubGraphQLError | InvalidChangelogRefError) =>
				apiError(error.message, error._tag === "GitHubGraphQLError" ? statusOf(error) : undefined),
			),
		);
		if (Option.isNone(found)) {
			return yield* Effect.fail(apiError(`commit ${params.commit} not found in ${params.repo}`));
		}
		const { user, pull, links } = found.value;
		return {
			user: Option.getOrNull(user),
			pull: Option.getOrNull(pull),
			links: {
				commit: links.commit,
				pull: Option.getOrNull(links.pull),
				user: Option.getOrNull(links.user),
			},
		};
	});
}

import type { Effect } from "effect";
import { Context } from "effect";
import type { GitHubCommitError } from "../errors/GitHubCommitError.js";

/**
 * A commit summary as returned by list and compare.
 *
 * @public
 */
export interface CommitSummary {
	readonly sha: string;
	readonly message: string;
	readonly author: string;
}

/**
 * A single commit with its parent SHAs.
 *
 * @public
 */
export interface CommitDetail extends CommitSummary {
	readonly parents: ReadonlyArray<{ readonly sha: string }>;
}

/**
 * A file changed between two commits/refs.
 *
 * @public
 */
export interface CommitFile {
	readonly filename: string;
	readonly status: string;
}

/**
 * Result of comparing two commits/refs (base...head).
 *
 * @public
 */
export interface CommitComparison {
	readonly commits: ReadonlyArray<CommitSummary>;
	readonly files: ReadonlyArray<CommitFile>;
}

/**
 * Service for reading the GitHub commit graph.
 *
 * @remarks
 * Distinct from `GitCommit`, which wraps the local `git` CLI. This service
 * wraps the GitHub REST API (`repos.getCommit` / `listCommits` /
 * `compareCommits`).
 *
 * @public
 */
export class GitHubCommit extends Context.Tag("github-action-effects/GitHubCommit")<
	GitHubCommit,
	{
		/** Get a single commit by ref (SHA or branch name). */
		readonly get: (ref: string) => Effect.Effect<CommitDetail, GitHubCommitError>;

		/** List commits reachable from a ref, paginated. */
		readonly list: (ref: string) => Effect.Effect<ReadonlyArray<CommitSummary>, GitHubCommitError>;

		/** Compare two commits/refs; returns the commits and changed files between base and head. */
		readonly compare: (base: string, head: string) => Effect.Effect<CommitComparison, GitHubCommitError>;

		/**
		 * List every file changed in a single commit, paginated.
		 *
		 * @remarks
		 * Backed by `repos.getCommit`, whose `files` array is capped at 300 per
		 * page but paginates by file for a single commit — so this returns the
		 * complete set even for large (e.g. squash-merge) commits. Prefer this
		 * over {@link compare} when the comparison is a single commit: the
		 * compare endpoint paginates by commit, so a one-commit comparison is
		 * permanently truncated to its first 300 files.
		 */
		readonly changedFiles: (ref: string) => Effect.Effect<ReadonlyArray<CommitFile>, GitHubCommitError>;
	}
>() {}

import type { Effect } from "effect";
import { Context } from "effect";
import type { GitBranchError } from "../errors/GitBranchError.js";

/**
 * Service shape for {@link GitBranch}.
 *
 * @public
 */
export interface GitBranchShape {
	/** Create a new branch pointing at the given SHA. */
	readonly create: (name: string, sha: string) => Effect.Effect<void, GitBranchError>;

	/** Check whether a branch exists. */
	readonly exists: (name: string) => Effect.Effect<boolean, GitBranchError>;

	/** Delete a branch. */
	readonly delete: (name: string) => Effect.Effect<void, GitBranchError>;

	/** Get the current SHA of a branch. */
	readonly getSha: (name: string) => Effect.Effect<string, GitBranchError>;

	/** Force-reset a branch to a new SHA. */
	readonly reset: (name: string, sha: string) => Effect.Effect<void, GitBranchError>;
}

/**
 * Service for GitHub branch management via Git Data API.
 *
 * @public
 */
export class GitBranch extends Context.Service<GitBranch, GitBranchShape>()("github-action-effects/GitBranch") {}

import { Data } from "effect";

/**
 * Error from GitHub commit operations.
 * @public
 */
export class GitHubCommitError extends Data.TaggedError("GitHubCommitError")<{
	/** The operation that failed. */
	readonly operation: "get" | "list" | "compare" | "changedFiles";

	/** The ref involved, when known. */
	readonly ref?: string;

	/** Human-readable description. */
	readonly reason: string;
}> {}

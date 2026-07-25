import { Data } from "effect";

/**
 * Error from branch management operations.
 * @public
 */
export class GitBranchError extends Data.TaggedError("GitBranchError")<{
	/** The branch name. */
	readonly branch: string;

	/** The operation that failed. */
	readonly operation: "create" | "delete" | "get" | "reset";

	/** Human-readable description. */
	readonly reason: string;

	/** HTTP status code from the underlying GitHub API failure, when available. */
	readonly status?: number | undefined;

	/**
	 * Structured discriminant for the benign create-race outcome: `true` when the
	 * underlying GitHub API failure was a 422/409 "Reference already exists"
	 * response, so callers can match on it directly instead of re-querying
	 * branch state to infer intent.
	 */
	readonly alreadyExists?: boolean | undefined;
}> {}

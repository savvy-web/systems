import { Data } from "effect";

/**
 * Error from GitHub GraphQL operations.
 * @public
 */
export class GitHubGraphQLError extends Data.TaggedError("GitHubGraphQLError")<{
	readonly operation: string;
	readonly reason: string;
	readonly errors: ReadonlyArray<{
		readonly message: string;
		readonly type?: string;
	}>;
}> {}

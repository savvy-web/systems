import type { Effect } from "effect";
import { Context } from "effect";
import type { GitHubGraphQLError } from "../errors/GitHubGraphQLError.js";

/**
 * Service shape for {@link GitHubGraphQL}.
 *
 * @public
 */
export interface GitHubGraphQLShape {
	readonly query: <T>(
		operation: string,
		queryString: string,
		variables?: Record<string, unknown>,
	) => Effect.Effect<T, GitHubGraphQLError>;

	readonly mutation: <T>(
		operation: string,
		mutationString: string,
		variables?: Record<string, unknown>,
	) => Effect.Effect<T, GitHubGraphQLError>;
}

/**
 * Service for GitHub GraphQL API operations.
 *
 * @public
 */
export class GitHubGraphQL extends Context.Service<GitHubGraphQL, GitHubGraphQLShape>()(
	"github-action-effects/GitHubGraphQL",
) {}

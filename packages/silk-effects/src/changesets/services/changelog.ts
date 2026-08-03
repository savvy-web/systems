/**
 * Changelog service tag definition.
 *
 * Defines the {@link ChangelogService} Effect service tag and its
 * {@link ChangelogServiceShape | shape interface} for dependency injection.
 * The actual formatting logic lives in `changelog/getReleaseLine.ts` and
 * `changelog/getDependencyReleaseLine.ts`; this module provides the
 * `Context.Service` that wires those implementations into the Effect runtime.
 *
 * @remarks
 * Unlike {@link GitHubService}, the
 * `ChangelogService` does not ship a default `Layer` — it is an abstract
 * service whose concrete implementation is the Changesets API entry point
 * (`\@savvy-web/changesets/changelog`). Consumer code should depend on
 * this tag when it needs to format release lines, then provide a layer
 * at the edge of the program.
 *
 * @see {@link ChangelogService} for the Effect service tag
 * @see {@link ChangelogServiceShape} for the service interface
 */

import type { Effect } from "effect";
import { Context } from "effect";

import type { ChangesetOptions } from "../schemas/options.js";
import type { ModCompWithPackage, NewChangesetWithCommit, VersionType } from "../vendor/types.js";
import type { GitHubService } from "./github.js";

/**
 * Service interface for changelog formatting.
 *
 * Describes the two operations a `ChangelogService` implementation must
 * provide: formatting individual release lines and formatting dependency
 * update tables.
 *
 * @remarks
 * Both methods return `Effect.Effect` values that require additional
 * services in their environment (`R` channel). `formatReleaseLine` needs
 * {@link GitHubService} (for commit metadata)
 * (for markdown parsing), while `formatDependencyReleaseLine` only needs
 * {@link GitHubService}.
 *
 * @public
 */
export interface ChangelogServiceShape {
	/**
	 * Format a single changeset into a markdown release line.
	 *
	 * @param changeset - The changeset to format, including its commit hash and summary
	 * @param versionType - The semantic version bump type (`major`, `minor`, or `patch`)
	 * @param options - Validated changeset configuration options (must include `repo`)
	 * @returns An `Effect` that resolves to a formatted markdown string
	 */
	readonly formatReleaseLine: (
		changeset: NewChangesetWithCommit,
		versionType: VersionType,
		options: ChangesetOptions,
	) => Effect.Effect<string, never, GitHubService>;

	/**
	 * Format dependency update release lines as a markdown table.
	 *
	 * @param changesets - The changesets that triggered the dependency updates
	 * @param dependenciesUpdated - The list of updated dependencies with version info
	 * @param options - Validated changeset configuration options (must include `repo`)
	 * @returns An `Effect` that resolves to a formatted markdown table string, or empty string if no updates
	 */
	readonly formatDependencyReleaseLine: (
		changesets: NewChangesetWithCommit[],
		dependenciesUpdated: ModCompWithPackage[],
		options: ChangesetOptions,
	) => Effect.Effect<string, never, GitHubService>;
}

/**
 * Effect service tag for changelog formatting.
 *
 * Provides dependency-injected access to the two Changesets API formatter
 * functions: `formatReleaseLine` and `formatDependencyReleaseLine`.
 *
 * @remarks
 * This is an abstract service tag — it has no default `Layer`. The concrete
 * implementation is the `\@savvy-web/changesets/changelog` subpath export,
 * which wires the formatting logic through `Effect.runPromise` for the
 * Changesets CLI. For direct Effect usage, build your own layer or use
 * the class-based `Changelog` wrapper.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { ChangesetOptions } from "\@savvy-web/changesets";
 * import { ChangelogService } from "\@savvy-web/changesets";
 *
 * const program = Effect.gen(function* () {
 *   const changelog = yield* ChangelogService;
 *   const line = yield* changelog.formatReleaseLine(changeset, "minor", options);
 *   return line;
 * });
 * ```
 *
 * @see {@link ChangelogServiceShape} for the service interface
 *
 * @public
 */
export class ChangelogService extends Context.Service<ChangelogService, ChangelogServiceShape>()("ChangelogService") {}

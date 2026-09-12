/**
 * Changesets API changelog formatter — `\@savvy-web/changesets/changelog`
 *
 * This module is the default export consumed by the Changesets CLI via the
 * `changelog` field in `.changeset/config.json`. It implements the
 * `ChangelogFunctions` interface from `\@changesets/types`, wiring the
 * Effect-based formatting pipeline into the async API that Changesets expects.
 *
 * @remarks
 * The module composes two Effect programs — {@link getReleaseLine} and
 * {@link getDependencyReleaseLine} — and runs each through
 * `Effect.runPromise` with `GitHubService.layer` (for commit metadata). Options are
 * validated at the boundary via `validateChangesetOptions` before being
 * passed to the formatters.
 *
 * ### Configuration
 *
 * Add the following to your `.changeset/config.json`:
 *
 * ```json
 * {
 *   "changelog": ["\@savvy-web/changesets/changelog", { "repo": "savvy-web/package-name" }]
 * }
 * ```
 *
 * The `repo` option is **required** and must be in `owner/repo` format.
 *
 * ### Pipeline
 *
 * 1. **Options validation** — the raw `options` object from the Changesets
 *    config is decoded through `ChangesetOptionsSchema`.
 * 2. **Release line formatting** — each changeset is formatted by
 *    `getReleaseLine`, which resolves GitHub metadata, parses sections,
 *    and produces structured markdown with attribution.
 * 3. **Dependency table formatting** — bulk dependency updates are
 *    formatted by `getDependencyReleaseLine` into a markdown table.
 *
 * @example Configuring in `.changeset/config.json`
 * ```json
 * {
 *   "$schema": "https://unpkg.com/\@changesets/config\@3.1.1/schema.json",
 *   "changelog": ["\@savvy-web/changesets/changelog", { "repo": "savvy-web/my-package" }],
 *   "commit": false,
 *   "access": "public"
 * }
 * ```
 *
 * @see {@link getReleaseLine} in `./getReleaseLine.ts` for individual changeset formatting
 * @see {@link getDependencyReleaseLine} in `./getDependencyReleaseLine.ts` for dependency table formatting
 */

import { Effect } from "effect";

import { validateChangesetOptions } from "../schemas/options.js";
import { GitHubService } from "../services/github.js";
import type { ChangesetLogModeValue } from "../utils/logger.js";
import { ChangesetLogMode } from "../utils/logger.js";
import type { ChangelogFunctions } from "../vendor/types.js";
import { getDependencyReleaseLine as getDependencyReleaseLineEffect } from "./getDependencyReleaseLine.js";
import { getReleaseLine as getReleaseLineEffect } from "./getReleaseLine.js";

/**
 * The layer providing every service the formatters need.
 *
 * `GitHubService.layer` satisfies the requirements of both `getReleaseLine` and
 * `getDependencyReleaseLine`, which each need only `GitHubService`. Markdown
 * parsing is not a layer: the formatters call the remark pipeline's
 * `parseMarkdown` / `stringifyMarkdown` functions directly.
 *
 * @internal
 */
const MainLayer = GitHubService.layer;

/**
 * Options for {@link makeChangelogFunctions}.
 *
 * @public
 */
export interface MakeChangelogFunctionsOptions {
	/**
	 * How warnings are emitted. Omit to leave the {@link ChangesetLogMode}
	 * default (`"stderr"`) in force.
	 */
	readonly logMode?: ChangesetLogModeValue | undefined;
}

/**
 * Build a Changesets `ChangelogFunctions` implementation bound to a warning
 * mode.
 *
 * @remarks
 * This module is engine code and reads no environment; the host that installs
 * the functions (the `\@savvy-web/changelog` package under the changesets CLI)
 * decides the mode from its own `process.env` and passes it here. Each method
 * validates options, runs the corresponding Effect program with the merged
 * service layer and the chosen {@link ChangesetLogMode}, and returns a
 * `Promise<string>`.
 *
 * @param options - The warning mode to provide
 * @returns A `ChangelogFunctions` object for `.changeset/config.json`
 *
 * @public
 */
export function makeChangelogFunctions(options: MakeChangelogFunctionsOptions = {}): ChangelogFunctions {
	const run = <A, E>(program: Effect.Effect<A, E, GitHubService>): Promise<A> => {
		const provided = program.pipe(Effect.provide(MainLayer));
		return Effect.runPromise(
			options.logMode === undefined
				? provided
				: provided.pipe(Effect.provideService(ChangesetLogMode, options.logMode)),
		);
	};

	return {
		getReleaseLine: async (changeset, versionType, options) =>
			run(
				Effect.gen(function* () {
					const opts = yield* validateChangesetOptions(options);
					return yield* getReleaseLineEffect(changeset, versionType, opts);
				}),
			),

		getDependencyReleaseLine: async (changesets, dependenciesUpdated, options) =>
			run(
				Effect.gen(function* () {
					const opts = yield* validateChangesetOptions(options);
					return yield* getDependencyReleaseLineEffect(changesets, dependenciesUpdated, opts);
				}),
			),
	};
}

/**
 * Changesets API `ChangelogFunctions` implementation with the default warning
 * mode (`"stderr"`).
 *
 * @remarks
 * Equivalent to `makeChangelogFunctions()`. A host that runs under GitHub
 * Actions or a test runner should call {@link makeChangelogFunctions} with the
 * mode it detects instead.
 *
 * @internal
 */
const changelogFunctions: ChangelogFunctions = makeChangelogFunctions();

export default changelogFunctions;

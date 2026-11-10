/**
 * Changesets API changelog formatter — `\@savvy-web/changesets/changelog`
 *
 * This module is the default export consumed by the Changesets CLI via the
 * `changelog` field in `.changeset/config.json`. It implements the kit's
 * `ChangelogFunctions` contract (`\@effected/changesets`, structurally
 * identical to `\@changesets/types`' so it loads under `\@changesets/cli`), wiring the
 * Effect-based formatting pipeline into the async API that Changesets expects.
 *
 * @remarks
 * The module composes two Effect programs — {@link getReleaseLine} and
 * {@link getDependencyReleaseLine} — and runs each through one runtime per
 * {@link makeChangelogFunctions} call, holding a `GitHubService` over the
 * host-supplied `ChangelogInfo` (for commit metadata). Options are
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

import type { ChangelogInfo } from "@effected/github";
import { Effect, Layer, ManagedRuntime } from "effect";

import { GitHubApiError } from "../errors.js";
import { validateChangesetOptions } from "../schemas/options.js";
import { GitHubService } from "../services/github.js";
import type { ChangesetLogModeValue } from "../utils/logger.js";
import { ChangesetLogMode } from "../utils/logger.js";
import type { ChangelogFunctions } from "../vendor/types.js";
import { getDependencyReleaseLine as getDependencyReleaseLineEffect } from "./getDependencyReleaseLine.js";
import { getReleaseLine as getReleaseLineEffect } from "./getReleaseLine.js";

/**
 * The `GitHubService` a build with no `changelogInfo` gets: every lookup fails
 * with a {@link GitHubApiError}, which the formatters already recover from by
 * omitting attribution — the same line upstream renders when it has no token.
 *
 * @internal
 */
const GitHubUnavailable: Layer.Layer<GitHubService> = Layer.succeed(GitHubService, {
	getInfo: (params) =>
		Effect.fail(
			new GitHubApiError({
				operation: "getCommitInfo",
				reason: `no GitHub client configured to look up commit ${params.commit}`,
			}),
		),
});

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
	/**
	 * Where commit metadata comes from: `\@effected/github`'s `ChangelogInfo`,
	 * typically `ChangelogInfo.layer` over a `GitHubClient` the host builds from
	 * its own token and server. Omit it and every lookup fails typed, so lines
	 * render without attribution — this engine reads no environment to find a
	 * token itself.
	 */
	readonly changelogInfo?: Layer.Layer<ChangelogInfo> | undefined;
}

/**
 * Build a Changesets `ChangelogFunctions` implementation bound to a warning
 * mode and a commit-metadata source.
 *
 * @remarks
 * This module is engine code and reads no environment; the host that installs
 * the functions (the `\@savvy-web/changelog` package under the changesets CLI)
 * decides the mode and builds the GitHub client from its own `process.env`
 * and passes both here. Each method validates options, runs the corresponding
 * Effect program on a runtime built once per call to this factory — so the
 * lookups the changesets engine starts concurrently share one `ChangelogInfo`
 * and are batched into one GraphQL query, as upstream's dataloader batches
 * them — and returns a `Promise<string>`.
 *
 * @param options - The warning mode and commit-metadata source to provide
 * @returns A `ChangelogFunctions` object for `.changeset/config.json`
 *
 * @public
 */
export function makeChangelogFunctions(options: MakeChangelogFunctionsOptions = {}): ChangelogFunctions {
	const github =
		options.changelogInfo === undefined
			? GitHubUnavailable
			: GitHubService.layer.pipe(Layer.provide(options.changelogInfo));
	let runtime: ManagedRuntime.ManagedRuntime<GitHubService, never> | undefined;
	const run = <A, E>(program: Effect.Effect<A, E, GitHubService>): Promise<A> => {
		runtime ??= ManagedRuntime.make(github);
		return runtime.runPromise(
			options.logMode === undefined ? program : program.pipe(Effect.provideService(ChangesetLogMode, options.logMode)),
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

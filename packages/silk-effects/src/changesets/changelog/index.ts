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
 * `Effect.runPromise` with a merged layer of {@link GitHubLive} (for commit
 * metadata) and {@link MarkdownLive} (for mdast parsing). Options are
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
 *    and produces structured markdown with commit links and attribution.
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
 *
 * @packageDocumentation
 */

import { Effect, Layer } from "effect";

import { validateChangesetOptions } from "../schemas/options.js";
import { GitHubLive } from "../services/github.js";
import { MarkdownLive } from "../services/markdown.js";
import type { ChangelogFunctions } from "../vendor/types.js";
import { getDependencyReleaseLine as getDependencyReleaseLineEffect } from "./getDependencyReleaseLine.js";
import { getReleaseLine as getReleaseLineEffect } from "./getReleaseLine.js";

/**
 * Combined layer providing all services needed by the formatters.
 *
 * Merges {@link GitHubLive} and {@link MarkdownLive} into a single layer
 * that satisfies the environment requirements of both `getReleaseLine`
 * (which needs `GitHubService` and `MarkdownService`) and
 * `getDependencyReleaseLine` (which needs `GitHubService`).
 *
 * @internal
 */
const MainLayer = Layer.mergeAll(GitHubLive, MarkdownLive);

/**
 * Changesets API `ChangelogFunctions` implementation.
 *
 * This object satisfies the `ChangelogFunctions` contract from
 * `\@changesets/types`. Each method validates options, runs the
 * corresponding Effect program with the merged service layer, and
 * returns a `Promise<string>`.
 *
 * @internal
 */
const changelogFunctions: ChangelogFunctions = {
	getReleaseLine: async (changeset, versionType, options) => {
		const program = Effect.gen(function* () {
			const opts = yield* validateChangesetOptions(options);
			return yield* getReleaseLineEffect(changeset, versionType, opts);
		});
		return Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
	},

	getDependencyReleaseLine: async (changesets, dependenciesUpdated, options) => {
		const program = Effect.gen(function* () {
			const opts = yield* validateChangesetOptions(options);
			return yield* getDependencyReleaseLineEffect(changesets, dependenciesUpdated, opts);
		});
		return Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
	},
};

export default changelogFunctions;

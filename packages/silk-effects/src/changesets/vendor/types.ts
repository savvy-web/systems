/**
 * Vendor type re-exports from `\@changesets/types`.
 *
 * @remarks
 * Re-exports key types from the `\@changesets/types` package that are
 * used throughout `\@savvy-web/changesets`. These types define the
 * contract between the Changesets CLI and custom changelog formatters.
 *
 * - {@link ChangelogFunctions} — the interface a changelog formatter must
 *   implement, with `getReleaseLine` and `getDependencyReleaseLine` methods
 * - {@link ModCompWithPackage} — a modified changeset entry paired with
 *   its package metadata, passed to `getDependencyReleaseLine`
 * - {@link NewChangesetWithCommit} — a changeset entry with its associated
 *   git commit hash, passed to `getReleaseLine`
 * - {@link VersionType} — the version bump type (`"major"`, `"minor"`, `"patch"`)
 *
 * Includes types derived from `\@changesets/types` (MIT license).
 *
 * @internal
 */

export type {
	/**
	 * Interface that a custom changelog formatter must implement.
	 *
	 * @remarks
	 * Defines two async methods:
	 * - `getReleaseLine(changeset, type, options)` — formats a single
	 *   changeset entry into a changelog line
	 * - `getDependencyReleaseLine(changesets, dependenciesUpdated, options)` —
	 *   formats dependency update information
	 *
	 * The `\@savvy-web/changesets` package implements this interface in
	 * the `./changelog` entry point.
	 */
	ChangelogFunctions,
	/**
	 * A modified changeset entry paired with package metadata.
	 *
	 * @remarks
	 * Passed to `ChangelogFunctions.getDependencyReleaseLine` to provide
	 * both the changeset content and the affected package's name, version,
	 * and directory.
	 */
	ModCompWithPackage,
	/**
	 * A changeset entry with its associated git commit hash.
	 *
	 * @remarks
	 * Extends the base `NewChangeset` type with a `commit` field containing
	 * the git SHA that introduced this changeset. Passed to
	 * `ChangelogFunctions.getReleaseLine`.
	 */
	NewChangesetWithCommit,
	/**
	 * The version bump type: `"major"`, `"minor"`, or `"patch"`.
	 *
	 * @remarks
	 * Corresponds to the semver bump level specified in a changeset's
	 * YAML frontmatter.
	 */
	VersionType,
} from "@changesets/types";

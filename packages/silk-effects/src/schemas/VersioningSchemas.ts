import { Schema } from "effect";

/**
 * Configuration for how private packages are handled during versioning.
 *
 * @remarks
 * When set to `false`, private packages are completely ignored.
 * When set to an object, `tag` and `version` control whether private packages
 * receive git tags and version bumps respectively.
 *
 * @since 0.2.0
 */
const PrivatePackagesConfig = Schema.Union(
	Schema.Struct({
		tag: Schema.optional(Schema.Boolean),
		version: Schema.optional(Schema.Boolean),
	}),
	Schema.Literal(false),
);

/**
 * Snapshot release configuration for changesets.
 *
 * @remarks
 * Controls how snapshot versions are generated.
 * `useCalculatedVersion` prepends the calculated version to the snapshot tag.
 * `prereleaseTemplate` is a custom template string for snapshot version format.
 *
 * @since 0.2.0
 */
const SnapshotConfig = Schema.Struct({
	useCalculatedVersion: Schema.optional(Schema.Boolean),
	prereleaseTemplate: Schema.optional(Schema.String),
});

/**
 * Standard changesets configuration matching the `@changesets/config@3.1.1` spec.
 *
 * @remarks
 * Represents the parsed `.changeset/config.json` file. All fields are optional
 * to allow partial configs. Use {@link SilkChangesetConfig} when the Silk changelog
 * adapter is detected.
 *
 * @since 0.1.0
 */
// Standard changesets config (matches @changesets/config@3.1.1 upstream spec)
export const ChangesetConfig = Schema.Struct({
	changelog: Schema.optional(Schema.Union(Schema.String, Schema.Array(Schema.Unknown), Schema.Literal(false))),
	commit: Schema.optional(Schema.Union(Schema.Boolean, Schema.String, Schema.Array(Schema.Unknown))),
	fixed: Schema.optional(Schema.Array(Schema.Array(Schema.String))),
	linked: Schema.optional(Schema.Array(Schema.Array(Schema.String))),
	access: Schema.optional(Schema.Literal("public", "restricted")),
	baseBranch: Schema.optional(Schema.String),
	updateInternalDependencies: Schema.optional(Schema.Literal("patch", "minor", "major")),
	ignore: Schema.optional(Schema.Array(Schema.String)),
	privatePackages: Schema.optional(PrivatePackagesConfig),
	prettier: Schema.optional(Schema.Boolean),
	changedFilePatterns: Schema.optional(Schema.Array(Schema.String)),
	bumpVersionsWithWorkspaceProtocolOnly: Schema.optional(Schema.Boolean),
	snapshot: Schema.optional(SnapshotConfig),
});
/** @since 0.1.0 */
export type ChangesetConfig = typeof ChangesetConfig.Type;

/**
 * Extended changeset config for repos using the `@savvy-web/changesets` changelog adapter.
 *
 * @remarks
 * Extends {@link ChangesetConfig} with a `_isSilk` marker flag that is automatically
 * set to `true`. Detected by {@link ChangesetConfigReader} when the `changelog` field
 * references `@savvy-web/changesets`.
 *
 * @since 0.1.0
 */
// Silk extension — detected by checking changelog field
export const SilkChangesetConfig = Schema.extend(
	ChangesetConfig,
	Schema.Struct({
		_isSilk: Schema.optionalWith(Schema.Boolean, { default: () => true }),
	}),
);
/** @since 0.1.0 */
export type SilkChangesetConfig = typeof SilkChangesetConfig.Type;

/**
 * Versioning strategy classification for a workspace.
 *
 * @remarks
 * - `"single"` — one publishable package; a single version tag is used.
 * - `"fixed-group"` — all publishable packages are in the same changesets fixed group.
 * - `"independent"` — multiple publishable packages with independent version bumps.
 *
 * @since 0.1.0
 */
export const VersioningStrategyType = Schema.Literal("single", "fixed-group", "independent");
/** @since 0.1.0 */
export type VersioningStrategyType = typeof VersioningStrategyType.Type;

/**
 * Output of the versioning strategy detection, combining the strategy type with group metadata.
 *
 * @remarks
 * Produced by {@link VersioningStrategy.detect} and consumed by {@link TagStrategy.determine}
 * to decide on the appropriate git-tag format.
 *
 * @since 0.1.0
 */
export const VersioningStrategyResult = Schema.Struct({
	type: VersioningStrategyType,
	fixedGroups: Schema.Array(Schema.Array(Schema.String)),
	publishablePackages: Schema.Array(Schema.String),
});
/** @since 0.1.0 */
export type VersioningStrategyResult = typeof VersioningStrategyResult.Type;

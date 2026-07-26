import { Effect, Schema } from "effect";

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
const PrivatePackagesConfig = Schema.Union([
	Schema.Struct({
		tag: Schema.optional(Schema.Boolean),
		version: Schema.optional(Schema.Boolean),
	}),
	Schema.Literal(false),
]);

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
 * Standard changesets configuration matching the `@changesets/config@4.0.0-next.6` spec.
 *
 * @remarks
 * Represents the parsed `.changeset/config.json` file. All fields are optional
 * to allow partial configs. Use {@link (SilkChangesetConfigFile:type)} when the Silk changelog
 * adapter is detected.
 *
 * @since 0.1.0
 */
// Standard changesets config (matches @changesets/config@4.0.0-next.6 upstream spec)
/** @public */
export const ChangesetConfigFile = Schema.Struct({
	changelog: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.Unknown), Schema.Literal(false)])),
	commit: Schema.optional(Schema.Union([Schema.Boolean, Schema.String, Schema.Array(Schema.Unknown)])),
	fixed: Schema.optional(Schema.Array(Schema.Array(Schema.String))),
	linked: Schema.optional(Schema.Array(Schema.Array(Schema.String))),
	access: Schema.optional(Schema.Literals(["public", "restricted"])),
	baseBranch: Schema.optional(Schema.String),
	updateInternalDependencies: Schema.optional(Schema.Literals(["patch", "minor", "major"])),
	ignore: Schema.optional(Schema.Array(Schema.String)),
	privatePackages: Schema.optional(PrivatePackagesConfig),
	prettier: Schema.optional(Schema.Boolean),
	changedFilePatterns: Schema.optional(Schema.Array(Schema.String)),
	bumpVersionsWithWorkspaceProtocolOnly: Schema.optional(Schema.Boolean),
	snapshot: Schema.optional(SnapshotConfig),
});
/**
 * @since 0.1.0
 * @public
 */
export type ChangesetConfigFile = typeof ChangesetConfigFile.Type;

/**
 * Extended changeset config for repos using the `@savvy-web/changesets` changelog adapter.
 *
 * @remarks
 * Extends {@link (ChangesetConfigFile:type)} with a `_isSilk` marker flag that is automatically
 * set to `true`. Detected by {@link ChangesetConfigReader} when the `changelog` field
 * references `@savvy-web/changesets`.
 *
 * @since 0.1.0
 */
// Silk extension — detected by checking changelog field
/** @public */
export const SilkChangesetConfigFile = Schema.Struct({
	...ChangesetConfigFile.fields,
	_isSilk: Schema.Boolean.pipe(
		Schema.withDecodingDefaultType(Effect.succeed(true)),
		Schema.withConstructorDefault(Effect.succeed(true)),
	),
});
/**
 * @since 0.1.0
 * @public
 */
export type SilkChangesetConfigFile = typeof SilkChangesetConfigFile.Type;

// Versioning classification itself lives upstream: `VersioningStrategy`
// (`classify`/`detect`/`tagsFor`) and `VersioningStrategyType` are value classes
// in `@effected/workspaces`. This module keeps only the changesets config file
// shapes, which are one release tool's schema and stay Silk's business.

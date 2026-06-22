/**
 * Result schemas for the {@link ReleasePlanner} service — the structured
 * preview of pending releases and the result of a native apply.
 *
 */

import { Schema } from "effect";

/** A semantic-version bump level (the `"none"` plan type is filtered out upstream). @public */
export const BumpTypeSchema = Schema.Literal("major", "minor", "patch");
/** A semantic-version bump level. @public */
export type BumpType = Schema.Schema.Type<typeof BumpTypeSchema>;

/** One package's previewed release: version transition + rendered changelog block. @public */
export const PreviewReleaseSchema = Schema.Struct({
	name: Schema.String,
	type: BumpTypeSchema,
	oldVersion: Schema.String,
	newVersion: Schema.String,
	changesetIds: Schema.Array(Schema.String),
	changelogEntry: Schema.String,
}).annotations({ identifier: "PreviewRelease" });
/** One package's previewed release. @public */
export type PreviewRelease = Schema.Schema.Type<typeof PreviewReleaseSchema>;

/** A parsed pending changeset (id + summary + the packages it bumps). @public */
export const PendingChangesetSchema = Schema.Struct({
	id: Schema.String,
	summary: Schema.String,
	releases: Schema.Array(Schema.Struct({ name: Schema.String, type: BumpTypeSchema })),
}).annotations({ identifier: "PendingChangeset" });
/** A parsed pending changeset. @public */
export type PendingChangeset = Schema.Schema.Type<typeof PendingChangesetSchema>;

/** Read-only preview of what the next release would produce. @public */
export const ChangesetPreviewSchema = Schema.Struct({
	preMode: Schema.NullOr(Schema.Literal("exit", "pre")),
	releases: Schema.Array(PreviewReleaseSchema),
	changesets: Schema.Array(PendingChangesetSchema),
}).annotations({ identifier: "ChangesetPreview" });
/** Read-only preview of what the next release would produce. @public */
export type ChangesetPreview = Schema.Schema.Type<typeof ChangesetPreviewSchema>;

/** One applied package release (version transition). @public */
export const AppliedReleaseEntrySchema = Schema.Struct({
	name: Schema.String,
	type: BumpTypeSchema,
	oldVersion: Schema.String,
	newVersion: Schema.String,
}).annotations({ identifier: "AppliedReleaseEntry" });

/** A single versionFiles update applied (or planned, when dry). @public */
export const VersionFileUpdateRecordSchema = Schema.Struct({
	filePath: Schema.String,
	version: Schema.String,
}).annotations({ identifier: "VersionFileUpdateRecord" });

/** Result of {@link ReleasePlanner.apply}. @public */
export const AppliedReleaseSchema = Schema.Struct({
	dryRun: Schema.Boolean,
	touchedFiles: Schema.Array(Schema.String),
	releases: Schema.Array(AppliedReleaseEntrySchema),
	versionFileUpdates: Schema.Array(VersionFileUpdateRecordSchema),
}).annotations({ identifier: "AppliedRelease" });
/** Result of a native apply. @public */
export type AppliedRelease = Schema.Schema.Type<typeof AppliedReleaseSchema>;

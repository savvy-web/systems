import { Schema } from "effect";

/**
 * An agent-appended note: a discovered answer stamped with the pin it was written against.
 * @public
 */
export const RepoNote = Schema.Struct({
	id: Schema.String,
	date: Schema.String,
	ref: Schema.String,
	note: Schema.String.pipe(Schema.minLength(1)),
});
/** @public */
export type RepoNote = typeof RepoNote.Type;

/**
 * Curated per-repo orientation: layout, entry points, where to start.
 * @public
 */
export const RepoOrientation = Schema.Struct({
	layout: Schema.optional(Schema.String),
	keyPaths: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
	startHere: Schema.optional(Schema.String),
});
/** @public */
export type RepoOrientation = typeof RepoOrientation.Type;

/**
 * One vendored repo: mechanical intent (url/ref/sparse) plus the agent brief.
 * @public
 */
export const RepoEntry = Schema.Struct({
	url: Schema.String.pipe(Schema.minLength(1)),
	ref: Schema.String.pipe(Schema.minLength(1)),
	purpose: Schema.String.pipe(Schema.minLength(1)),
	sparse: Schema.optional(Schema.Array(Schema.String)),
	orientation: Schema.optional(RepoOrientation),
	notes: Schema.optional(Schema.Array(RepoNote)),
});
/** @public */
export type RepoEntry = typeof RepoEntry.Type;

/**
 * The committed .repos/config.json manifest.
 * @public
 */
export const ReposManifestFile = Schema.Struct({
	repos: Schema.Record({ key: Schema.String, value: RepoEntry }),
});
/** @public */
export type ReposManifestFile = typeof ReposManifestFile.Type;

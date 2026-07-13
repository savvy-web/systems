import { Schema } from "effect";

/**
 * A vendored-repo manifest key: non-empty, contains no `/` or `\`, and is
 * never `.` or `..` — safe to join onto a filesystem path segment
 * (`.repos/<name>`) without escaping the `.repos/` directory.
 * @public
 */
export const RepoName = Schema.String.pipe(
	Schema.pattern(/^(?!\.{1,2}$)[A-Za-z0-9][A-Za-z0-9._-]*$/),
	Schema.annotations({ identifier: "RepoName" }),
);
/** @public */
export type RepoName = typeof RepoName.Type;

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
 * Bad-key guard for {@link ReposManifestFile}.
 *
 * @remarks
 * `Schema.Record`'s key schema has "pick matching keys" semantics: a key
 * that fails to decode against the key schema is silently OMITTED from the
 * decoded record rather than failing the decode (Effect Schema issue-free
 * by design, since a record's key schema is also used to select entries out
 * of a wider object). That is the opposite of what a manifest guard needs —
 * a bad key must REJECT the whole decode, not vanish. So `repos` decodes
 * with a permissive `Schema.String` key (nothing is dropped) and this
 * filter walks every key against {@link RepoName} itself, failing loudly
 * and naming the offending key.
 */
const isRepoName = Schema.is(RepoName);

/**
 * The committed .repos/config.json manifest.
 * @public
 */
export const ReposManifestFile = Schema.Struct({
	repos: Schema.Record({ key: Schema.String, value: RepoEntry }).pipe(
		Schema.filter((repos) => {
			const badKey = Object.keys(repos).find((key) => !isRepoName(key));
			return badKey === undefined
				? undefined
				: `every repos key must be a valid RepoName (non-empty, no "/" or "\\", not "." or ".."); got ${JSON.stringify(badKey)}`;
		}),
	),
});
/** @public */
export type ReposManifestFile = typeof ReposManifestFile.Type;

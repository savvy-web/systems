import { Schema } from "effect";

/**
 * Status of one vendored repo: gitlink presence and dirtiness, plus notes
 * that no longer match the pinned ref.
 * @public
 */
export const RepoStatusEntry = Schema.Struct({
	name: Schema.String,
	ref: Schema.String,
	purpose: Schema.String,
	present: Schema.Boolean,
	commit: Schema.NullOr(Schema.String),
	dirty: Schema.Boolean,
	staleNoteIds: Schema.Array(Schema.String),
});
/** @public */
export type RepoStatusEntry = typeof RepoStatusEntry.Type;

/**
 * Status across all vendored repos in the manifest.
 * @public
 */
export const ReposStatusReport = Schema.Struct({
	repos: Schema.Array(RepoStatusEntry),
	clean: Schema.Boolean,
});
/** @public */
export type ReposStatusReport = typeof ReposStatusReport.Type;

/**
 * Result of reconciling working-tree submodules with the manifest: missing
 * repos initialized, sparse-checkout patterns re-applied, already-present
 * repos left alone, and stale locks cleared.
 * @public
 */
export const ReposSyncReport = Schema.Struct({
	initialized: Schema.Array(Schema.String),
	sparseApplied: Schema.Array(Schema.String),
	upToDate: Schema.Array(Schema.String),
	clearedLocks: Schema.Array(Schema.String),
});
/** @public */
export type ReposSyncReport = typeof ReposSyncReport.Type;

/**
 * Result of re-pinning a vendored repo to a new ref.
 * @public
 */
export const ReposPinResult = Schema.Struct({
	name: Schema.String,
	ref: Schema.String,
	oldCommit: Schema.NullOr(Schema.String),
	newCommit: Schema.String,
	commitMessage: Schema.String,
	staleNoteIds: Schema.Array(Schema.String),
});
/** @public */
export type ReposPinResult = typeof ReposPinResult.Type;

/**
 * Result of adding a new vendored repo to the manifest.
 * @public
 */
export const ReposAddResult = Schema.Struct({
	name: Schema.String,
	ref: Schema.String,
	path: Schema.String,
});
/** @public */
export type ReposAddResult = typeof ReposAddResult.Type;

/**
 * Result of an agent-note mutation against a vendored repo.
 * @public
 */
export const ReposNoteResult = Schema.Struct({
	name: Schema.String,
	op: Schema.Literals(["add", "remove", "promote"]),
	id: Schema.String,
	noteCount: Schema.Number,
});
/** @public */
export type ReposNoteResult = typeof ReposNoteResult.Type;

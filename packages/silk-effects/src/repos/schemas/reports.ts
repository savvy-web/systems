import { Schema } from "effect";
import { RepoEntry, RepoNote } from "./manifest.js";

/**
 * Status of one vendored repo: gitlink presence and dirtiness, plus notes
 * that no longer match the pinned ref.
 *
 * @remarks
 * The gitlink is reported as an index-aware TRIPLE — `stagedCommit` (the
 * index), `committedCommit` (`HEAD`), `checkedOutCommit` (the submodule's own
 * worktree) — because those three legitimately disagree during a pin, and a
 * single field cannot say which one it means. A deprecated `commit` alias of
 * `stagedCommit` bridged one release and is now gone; read `stagedCommit`.
 * @public
 */
export const RepoStatusEntry = Schema.Struct({
	name: Schema.String,
	ref: Schema.String,
	purpose: Schema.String,
	present: Schema.Boolean,
	/** The gitlink oid staged in the index (`git ls-files --stage`) — sees a pin BEFORE it is committed. */
	stagedCommit: Schema.optionalKey(Schema.String),
	/** The gitlink oid committed at `HEAD` (`git ls-tree HEAD`). */
	committedCommit: Schema.optionalKey(Schema.String),
	/** The commit actually checked out in the submodule worktree (`git rev-parse HEAD` inside it); absent when there is no checkout. */
	checkedOutCommit: Schema.optionalKey(Schema.String),
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
 * repos left alone, stale locks cleared, drifted submodule URLs reconciled,
 * orphan manifest entries (no gitlink at all) registered, and the vendored
 * boundary re-declared to git.
 * @public
 */
export const ReposSyncReport = Schema.Struct({
	initialized: Schema.Array(Schema.String),
	sparseApplied: Schema.Array(Schema.String),
	upToDate: Schema.Array(Schema.String),
	clearedLocks: Schema.Array(Schema.String),
	urlSynced: Schema.Array(Schema.String),
	registered: Schema.Array(Schema.String),
	/**
	 * Repos whose `submodule.<path>.update = none` marker was (re-)asserted in
	 * the superproject's local config — the declarative half of the vendored
	 * boundary, telling every git client to skip these trees rather than
	 * letting them discover the boundary by failing against a permission
	 * error.
	 */
	boundaryMarked: Schema.Array(Schema.String),
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
 * Result of removing a vendored repo from the manifest: the gitlink, module
 * gitdir, and `.gitmodules` section are all gone, and the entry that was
 * removed is handed back so nothing durable is lost.
 *
 * @remarks
 * `removedEntry` is the whole manifest entry, and it exists because
 * remove-then-re-add is the standing remedy for several vendored-tree
 * problems. `add` does not resurrect anything on its own, so without the
 * entry in hand a caller following that remedy silently destroys the
 * `orientation` block — larger and far harder to reconstruct than the notes,
 * and invisible afterwards in every report an agent would think to check.
 * Pass `removedEntry.orientation` straight back to `add` to make a re-vendor
 * lossless.
 *
 * `removedNotes` is retained alongside it, and is exactly
 * `removedEntry.notes ?? []`. Notes are ephemeral by policy — a last look
 * before they go, so a durable one can be promoted elsewhere — whereas
 * orientation is meant to survive.
 * @public
 */
export const ReposRemoveResult = Schema.Struct({
	name: Schema.String,
	path: Schema.String,
	commitMessage: Schema.String,
	removedNotes: Schema.Array(RepoNote),
	removedEntry: RepoEntry,
});
/** @public */
export type ReposRemoveResult = typeof ReposRemoveResult.Type;

/**
 * Result of renaming a vendored repo's manifest key: the `.repos/<name>`
 * worktree moved, the module gitdir's `core.worktree` values re-pointed, the
 * `.gitmodules` section canonicalized to the new name, and the manifest key
 * renamed.
 * @public
 */
export const ReposRenameResult = Schema.Struct({
	oldName: Schema.String,
	newName: Schema.String,
	path: Schema.String,
	commitMessage: Schema.String,
});
/** @public */
export type ReposRenameResult = typeof ReposRenameResult.Type;

/**
 * Result of hard-resetting one or more vendored repos to their staged (or
 * committed) gitlink commit and re-applying sparse-checkout paths.
 *
 * @remarks
 * `restored` lists every repo actually reset, paired with the commit it was
 * reset to. `skippedClean` is populated ONLY by the names-omitted form of
 * {@link ReposManagerShape.restore} — repos left untouched because `status`
 * reported them clean; an explicit-names call never skips anything (an
 * explicit ask is always honored), so it always reports an empty array.
 *
 * `stillDirty` is the honesty channel: a repo that was reset but whose
 * worktree is STILL dirty afterwards. `restored` alone cannot express that —
 * it says what was attempted, not what was achieved — and a caller reading
 * only `restored` would take a report of a repo that never came clean as
 * success. Membership in both `restored` and `stillDirty` is the normal shape
 * for such a repo.
 * @public
 */
export const ReposRestoreResult = Schema.Struct({
	restored: Schema.Array(Schema.Struct({ name: Schema.String, commit: Schema.String })),
	skippedClean: Schema.Array(Schema.String),
	stillDirty: Schema.Array(Schema.String),
});
/** @public */
export type ReposRestoreResult = typeof ReposRestoreResult.Type;

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

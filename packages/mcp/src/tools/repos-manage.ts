/**
 * The `repos_manage` MCP tool: one action-discriminated mutating tool
 * covering `sync`, `pin`, `add`, `note`, `remove`, `rename`, `restore`, and
 * `deregister` against the vendored `.repos/` submodules. The wire schema is flat (no
 * `oneOf`); the handler maps it into an internal `Schema.TaggedStruct`
 * request union that names the missing field per action on decode failure.
 * Mutating — no `readOnlyHint`.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Schema, SchemaGetter } from "effect";
import { mdInline } from "./md-inline.js";

/** `sync` has no extra fields. */
const SyncRequest = Schema.TaggedStruct("sync", {});

/** `pin` requires both `name` and `ref`. */
const PinRequest = Schema.TaggedStruct("pin", {
	name: Schema.String,
	ref: Schema.String,
});

/**
 * `add` requires `url`/`ref`/`purpose`; `name`, `sparse` and `orientation`
 * are optional. `orientation` is what makes a re-vendor lossless — pass back
 * the block a preceding `remove` reported.
 */
const AddRequest = Schema.TaggedStruct("add", {
	url: Schema.String,
	ref: Schema.String,
	purpose: Schema.String,
	name: Schema.optional(Schema.String),
	sparse: Schema.optional(Schema.Array(Schema.String)),
	orientation: Schema.optional(Repos.RepoOrientation),
});

/**
 * `note` requires `name` and `op`; the fields required beyond that depend on
 * `op` — enforced by the trailing filter so the decode error names exactly
 * what's missing for the chosen op.
 */
const NoteRequest = Schema.TaggedStruct("note", {
	name: Schema.String,
	op: Schema.Literals(["add", "remove", "promote"]),
	note: Schema.optional(Schema.String),
	id: Schema.optional(Schema.String),
	into: Schema.optional(Schema.Literals(["layout", "startHere"])),
}).check(
	Schema.makeFilter((request) => {
		if (request.op === "add" && request.note === undefined) {
			return 'note op "add" requires `note`';
		}
		if (request.op === "remove" && request.id === undefined) {
			return 'note op "remove" requires `id`';
		}
		if (request.op === "promote" && (request.id === undefined || request.into === undefined)) {
			return 'note op "promote" requires both `id` and `into`';
		}
		return true;
	}),
);

/** `remove` requires only `name`. */
const RemoveRequest = Schema.TaggedStruct("remove", {
	name: Schema.String,
});

/** `rename` requires `name` (the old name) and `newName`. */
const RenameRequest = Schema.TaggedStruct("rename", {
	name: Schema.String,
	newName: Schema.String,
});

/** `restore`'s `names` is optional and repeatable, mirroring `add`'s `sparse`; omitted means "every dirty entry". */
const RestoreRequest = Schema.TaggedStruct("restore", {
	names: Schema.optional(Schema.Array(Schema.String)),
});

/**
 * `deregister` requires `section` — the stale registration name exactly as the
 * drift report states it (e.g. `.repos/old-name`); the `submodule.` prefix is
 * implied, never passed.
 */
const DeregisterRequest = Schema.TaggedStruct("deregister", {
	section: Schema.String,
});

/** Internal tagged-union request the flat wire args decode into. */
const ReposManageRequest = Schema.Union([
	SyncRequest,
	PinRequest,
	AddRequest,
	NoteRequest,
	RemoveRequest,
	RenameRequest,
	RestoreRequest,
	DeregisterRequest,
]);

/** `sync` result variant. */
export const ReposManageSyncResult = Schema.Struct({
	action: Schema.Literal("sync"),
	result: Repos.ReposSyncReport,
}).annotate({ identifier: "ReposManageSyncResult" });

/** `pin` result variant. */
export const ReposManagePinResult = Schema.Struct({
	action: Schema.Literal("pin"),
	result: Repos.ReposPinResult,
}).annotate({ identifier: "ReposManagePinResult" });

/** `add` result variant. */
export const ReposManageAddResult = Schema.Struct({
	action: Schema.Literal("add"),
	result: Repos.ReposAddResult,
}).annotate({ identifier: "ReposManageAddResult" });

/** `note` result variant. */
export const ReposManageNoteResult = Schema.Struct({
	action: Schema.Literal("note"),
	result: Repos.ReposNoteResult,
}).annotate({ identifier: "ReposManageNoteResult" });

/** `remove` result variant. */
export const ReposManageRemoveResult = Schema.Struct({
	action: Schema.Literal("remove"),
	result: Repos.ReposRemoveResult,
}).annotate({ identifier: "ReposManageRemoveResult" });

/** `rename` result variant. */
export const ReposManageRenameResult = Schema.Struct({
	action: Schema.Literal("rename"),
	result: Repos.ReposRenameResult,
}).annotate({ identifier: "ReposManageRenameResult" });

/** `restore` result variant. */
export const ReposManageRestoreResult = Schema.Struct({
	action: Schema.Literal("restore"),
	result: Repos.ReposRestoreResult,
}).annotate({ identifier: "ReposManageRestoreResult" });

/** `deregister` result variant. */
export const ReposManageDeregisterResult = Schema.Struct({
	action: Schema.Literal("deregister"),
	result: Repos.ReposDeregisterResult,
}).annotate({ identifier: "ReposManageDeregisterResult" });

/** The `repos_manage` tool result — a discriminated union keyed by `action`. */
export const ReposManageResult = Schema.Union([
	ReposManageSyncResult,
	ReposManagePinResult,
	ReposManageAddResult,
	ReposManageNoteResult,
	ReposManageRemoveResult,
	ReposManageRenameResult,
	ReposManageRestoreResult,
	ReposManageDeregisterResult,
]).annotate({
	identifier: "ReposManageResult",
	title: "repos_manage result",
	description: "Result of a mutating repos action: sync, pin, add, note, remove, rename, restore, or deregister.",
});

export type ReposManageResultType = Schema.Schema.Type<typeof ReposManageResult>;

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: ReposManageResultType): string => {
	switch (data.action) {
		case "sync": {
			const r = data.result;
			const section = (title: string, names: ReadonlyArray<string>) => [
				`## ${title}`,
				...(names.length > 0 ? names.map((name) => `- ${mdInline(name)}`) : ["(none)"]),
			];
			return [
				`# repos sync`,
				``,
				...section("Initialized", r.initialized),
				``,
				...section("Sparse applied", r.sparseApplied),
				``,
				...section("Up to date", r.upToDate),
				``,
				...section("Cleared locks", r.clearedLocks),
				``,
				...section("URL synced", r.urlSynced),
				``,
				...section("Registered", r.registered),
				``,
				...section("Boundary marked", r.boundaryMarked),
			].join("\n");
		}
		case "pin": {
			const r = data.result;
			const lines = [
				`# repos pin — ${mdInline(r.name)}`,
				``,
				`ref: ${mdInline(r.ref)}`,
				`oldCommit: ${r.oldCommit ? mdInline(r.oldCommit) : "(none)"}`,
				`newCommit: ${mdInline(r.newCommit)}`,
				``,
				`## Commit message`,
				``,
				mdInline(r.commitMessage),
				``,
				`## Stale notes`,
				``,
			];
			if (r.staleNoteIds.length > 0) {
				lines.push(
					`These notes reference a ref other than the new pin and should be reviewed before committing:`,
					...r.staleNoteIds.map((id) => `- ${mdInline(id)}`),
				);
			} else {
				lines.push("(none)");
			}
			lines.push(
				``,
				`REVIEW AND COMMIT: stage the updated manifest and submodule gitlink, then commit using the message above.`,
			);
			return lines.join("\n");
		}
		case "add": {
			const r = data.result;
			return [`# repos add — ${mdInline(r.name)}`, ``, `ref: ${mdInline(r.ref)}`, `path: ${mdInline(r.path)}`].join(
				"\n",
			);
		}
		case "note": {
			const r = data.result;
			return [
				`# repos note — ${mdInline(r.name)}`,
				``,
				`op: ${mdInline(r.op)}`,
				`id: ${mdInline(r.id)}`,
				`noteCount: ${r.noteCount}`,
			].join("\n");
		}
		case "remove": {
			const r = data.result;
			const lines = [
				`# repos remove — ${mdInline(r.name)}`,
				``,
				`path: ${mdInline(r.path)}`,
				``,
				`## Commit message`,
				``,
				mdInline(r.commitMessage),
				``,
				`## Removed notes`,
				``,
			];
			if (r.removedNotes.length > 0) {
				lines.push(
					`Promote any durable ones elsewhere before committing:`,
					...r.removedNotes.map((note) => `- ${mdInline(note.id)} (${mdInline(note.ref)}): ${mdInline(note.note)}`),
				);
			} else {
				lines.push("(none)");
			}
			// The orientation block is the durable half of an entry and `add`
			// does not resurrect it, so a caller following the standard
			// remove-then-re-add remedy loses it unless it is put in front of
			// them HERE, while they still have it. Echo it verbatim as JSON so
			// it can be handed straight back to `add`'s `orientation` parameter.
			if (r.removedEntry.orientation) {
				lines.push(
					``,
					`## Removed orientation`,
					``,
					`\`add\` does NOT restore this. If you are re-vendoring ${mdInline(r.name)}, pass it back as the \`orientation\` argument:`,
					``,
					"```json",
					JSON.stringify(r.removedEntry.orientation, null, 2),
					"```",
				);
			}
			lines.push(
				``,
				`REVIEW AND COMMIT: the manifest, .gitmodules, and gitlink removal are already staged — review and commit using the message above.`,
			);
			return lines.join("\n");
		}
		case "rename": {
			const r = data.result;
			return [
				`# repos rename — ${mdInline(r.oldName)} → ${mdInline(r.newName)}`,
				``,
				`path: ${mdInline(r.path)}`,
				``,
				`## Commit message`,
				``,
				mdInline(r.commitMessage),
				``,
				`REVIEW AND COMMIT: the moved worktree, .gitmodules section, and manifest key are already staged — review and commit using the message above.`,
			].join("\n");
		}
		case "restore": {
			const r = data.result;
			const lines = [`# repos restore`, ``, `## Restored`, ``];
			if (r.restored.length > 0) {
				lines.push(
					`DESTRUCTIVE: any uncommitted worktree edits and untracked files in these repos were discarded — the working tree was hard-reset to the commit below and sparse paths re-applied.`,
					``,
					...r.restored.map((entry) => `- ${mdInline(entry.name)} → ${mdInline(entry.commit)}`),
				);
			} else {
				lines.push("(none)");
			}
			lines.push(``, `## Skipped (clean)`, ``);
			if (r.skippedClean.length > 0) {
				lines.push(...r.skippedClean.map((name) => `- ${mdInline(name)}`));
			} else {
				lines.push("(none)");
			}
			// Only rendered when non-empty: this is an exception report, and a
			// standing "## Still dirty — (none)" heading on every clean restore
			// would train a reader to skip past the one section that matters.
			if (r.stillDirty.length > 0) {
				lines.push(
					``,
					`## Still dirty — RESTORE DID NOT FULLY SUCCEED`,
					``,
					`The reset ran but these worktrees remain dirty, so treat the restore as incomplete rather than done:`,
					``,
					...r.stillDirty.map((name) => `- ${mdInline(name)}`),
					``,
					`Run repos_inspect (mode: drift) — a nestedSubmoduleDivergence or a permission problem is the usual cause.`,
				);
			}
			return lines.join("\n");
		}
		case "deregister": {
			const r = data.result;
			const lines = [
				`# repos deregister — ${mdInline(r.section)}`,
				``,
				`Removed the stale ${mdInline(`submodule.${r.section}`)} section from the superproject's LOCAL git config. Keys cleared:`,
				``,
				...r.removedKeys.map((key) => `- ${mdInline(key)}`),
				``,
				`Local config only — nothing is staged and there is nothing to commit.`,
			];
			return lines.join("\n");
		}
	}
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ReposManageAsMarkdown = ReposManageResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "ReposManageAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

/** Flat wire arguments for the {@link reposManage} handler. */
export interface ReposManageArgs {
	readonly action: "sync" | "pin" | "add" | "note" | "remove" | "rename" | "restore" | "deregister";
	readonly name?: string;
	readonly newName?: string;
	readonly ref?: string;
	readonly url?: string;
	readonly purpose?: string;
	readonly sparse?: ReadonlyArray<string>;
	/** `add` only: the orientation block to write, so a re-vendor keeps the one a preceding `remove` reported. */
	readonly orientation?: Repos.RepoOrientation;
	readonly op?: "add" | "remove" | "promote";
	readonly note?: string;
	readonly id?: string;
	readonly into?: "layout" | "startHere";
	readonly names?: ReadonlyArray<string>;
	/** `deregister` only: the stale registration name as the drift report states it (e.g. `.repos/old-name`). */
	readonly section?: string;
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root, decode the flat wire args into
 * the internal per-action request (naming the missing field on failure), then
 * dispatch to the matching `ReposManager` method.
 */
export const reposManage = (
	args: ReposManageArgs,
	fallbackCwd: string,
): Effect.Effect<
	ReposManageResultType,
	| Repos.ReposConfigError
	| Repos.GitSubmoduleError
	| Repos.RepoNotFoundError
	| Repos.NoteNotFoundError
	| Repos.ReposLockdownError
	| Schema.SchemaError
	| WorkspaceRootNotFoundError,
	Repos.ReposManager | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		const manager = yield* Repos.ReposManager;

		const { action, cwd: _cwd, ...rest } = args;
		const request = yield* Schema.decodeUnknownEffect(ReposManageRequest)({ _tag: action, ...rest });

		switch (request._tag) {
			case "sync": {
				const result = yield* manager.sync(root);
				return { action: "sync", result } as ReposManageResultType;
			}
			case "pin": {
				const result = yield* manager.pin(root, request.name, request.ref);
				return { action: "pin", result } as ReposManageResultType;
			}
			case "add": {
				const result = yield* manager.add(root, {
					url: request.url,
					ref: request.ref,
					purpose: request.purpose,
					...(request.name !== undefined ? { name: request.name } : {}),
					...(request.sparse !== undefined ? { sparse: request.sparse } : {}),
					...(request.orientation !== undefined ? { orientation: request.orientation } : {}),
				});
				return { action: "add", result } as ReposManageResultType;
			}
			case "note": {
				const noteOp =
					request.op === "add"
						? ({ op: "add", note: request.note as string } as const)
						: request.op === "remove"
							? ({ op: "remove", id: request.id as string } as const)
							: ({ op: "promote", id: request.id as string, into: request.into as "layout" | "startHere" } as const);
				const result = yield* manager.note(root, request.name, noteOp);
				return { action: "note", result } as ReposManageResultType;
			}
			case "remove": {
				const result = yield* manager.remove(root, request.name);
				return { action: "remove", result } as ReposManageResultType;
			}
			case "rename": {
				const result = yield* manager.rename(root, request.name, request.newName);
				return { action: "rename", result } as ReposManageResultType;
			}
			case "restore": {
				const result = yield* manager.restore(root, request.names);
				return { action: "restore", result } as ReposManageResultType;
			}
			case "deregister": {
				const result = yield* manager.deregister(root, request.section);
				return { action: "deregister", result } as ReposManageResultType;
			}
		}
	});

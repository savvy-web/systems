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

import { ToolFailure } from "@effected/mcp";
import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, invalidArgument, mapEngineError } from "../errors.js";

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

/** Wire parameters for `repos_manage`: flat (no `oneOf`); the handler decodes them per action. */
export const ReposManageParams = Schema.Struct({
	action: Schema.Literals(["sync", "pin", "add", "note", "remove", "rename", "restore", "deregister"]).annotate({
		description: "Which mutation to perform.",
	}),
	name: Schema.optionalKey(
		Schema.String.annotate({ description: "Repo name (pin, note, remove, rename; optional override for add)." }),
	),
	newName: Schema.optionalKey(Schema.String.annotate({ description: "New repo name (rename)." })),
	ref: Schema.optionalKey(Schema.String.annotate({ description: "Git ref to pin/vendor to (pin, add)." })),
	url: Schema.optionalKey(Schema.String.annotate({ description: "Repo URL to vendor (add)." })),
	purpose: Schema.optionalKey(Schema.String.annotate({ description: "One-line purpose for the manifest (add)." })),
	sparse: Schema.optionalKey(Schema.Array(Schema.String).annotate({ description: "Sparse-checkout patterns (add)." })),
	orientation: Schema.optionalKey(
		Repos.RepoOrientation.annotate({
			description:
				"Orientation block to write (add). Pass back what a preceding remove reported as removedEntry.orientation — add does NOT restore it on its own, so a re-vendor loses it otherwise.",
		}),
	),
	op: Schema.optionalKey(
		Schema.Literals(["add", "remove", "promote"]).annotate({ description: "Note operation (note)." }),
	),
	note: Schema.optionalKey(Schema.String.annotate({ description: "Note text (note, op=add)." })),
	id: Schema.optionalKey(Schema.String.annotate({ description: "Note id (note, op=remove|promote)." })),
	into: Schema.optionalKey(
		Schema.Literals(["layout", "startHere"]).annotate({ description: "Orientation target (note, op=promote)." }),
	),
	names: Schema.optionalKey(
		Schema.Array(Schema.String).annotate({
			description: "Repo names to restore (restore); omitted restores every dirty repo.",
		}),
	),
	section: Schema.optionalKey(
		Schema.String.annotate({
			description:
				"Stale registration name to clear (deregister), exactly as the drift report states it (e.g. .repos/old-name); the submodule. prefix is implied.",
		}),
	),
	cwd: Schema.optionalKey(Schema.String.annotate({ description: "Directory to resolve the workspace root from." })),
});
export type ReposManageParams = typeof ReposManageParams.Type;

const REMEDIATION = {
	hint: "The mutation did not complete; inspect the vendored-repo state before retrying.",
	suggestedTool: "repos_inspect",
};

const REQUEST_REMEDIATION = {
	hint: "Pass the fields the chosen action needs (pin: name+ref; add: url+ref+purpose; note: name+op plus note/id/into; remove: name; rename: name+newName; deregister: section).",
};

/** The `repos_manage` tool value. Mutating: not read-only, not idempotent. */
export const reposManageTool = Tool.make("repos_manage", {
	description:
		"Mutating: sync (initialize/reconcile submodules per the manifest), pin (re-pin a repo to a new ref), add (vendor a new repo), note (add/remove/promote an agent note), remove (unvendor a repo), rename (rename a vendored repo's manifest key and worktree), restore (hard-reset a repo's worktree back to its pinned gitlink commit and re-apply sparse paths — DESTRUCTIVE to uncommitted worktree edits; never run implicitly), or deregister (clear a STALE submodule.<section> registration from the superproject's local git config — the phantom entry repos_inspect drift reports as localRegistrationDivergence with no matching manifest entry; refuses a section outside .repos/ and any section still backing a live manifest entry — canonically named or gitdir-diverged — and touches local config only, so nothing is staged). Pass action plus the fields that action needs: pin needs name+ref; add needs url+ref+purpose (name/sparse/orientation optional — pass orientation back from a preceding remove's removedEntry to make a re-vendor lossless); note needs name+op, plus note (op=add), id (op=remove), or id+into (op=promote); remove needs name; rename needs name (the old name) + newName; restore takes an optional names list — omitted, it restores every dirty repo and reports the clean ones as skipped; given, it restores exactly those repos even if already clean; deregister needs section (the registration name exactly as the drift report states it, e.g. .repos/old-name — no submodule. prefix). A decode failure names the missing field. The pin result surfaces commitMessage and staleNoteIds — review and commit after pinning. The remove result surfaces commitMessage, removedNotes and the removed entry's orientation block — promote any durable notes elsewhere, keep the orientation if you intend to re-vendor, then review and commit. The rename result surfaces commitMessage — review and commit after renaming. The restore result names exactly what was discarded. The deregister result lists the config keys the removed section carried — nothing to commit afterwards. Returns a typed object in structuredContent (content[] carries the same object as JSON).",
	parameters: ReposManageParams,
	success: ReposManageResult,
	failure: McpToolError,
	dependencies: [Repos.ReposManager, WorkspaceRoot],
})
	.annotate(Tool.Title, "Manage vendored repos")
	.annotate(Tool.Readonly, false)
	.annotate(Tool.Destructive, true)
	.annotate(Tool.Idempotent, false)
	.annotate(Tool.OpenWorld, false);

/**
 * Wire handler: {@link reposManage} with its error channel mapped onto
 * {@link McpToolError}. The per-action request decode failure (`SchemaError`,
 * which names the missing field, and echoes the decoded value) is an argument
 * problem and becomes {@link InvalidArgument} keyed on `action`, its text
 * truncated at `ToolFailure.ENGINE_ECHO_LIMIT`; the engine's own errors go
 * through {@link mapEngineError}.
 */
export const handleReposManage = (fallbackCwd: string, params: ReposManageParams) =>
	reposManage(params, fallbackCwd).pipe(
		Effect.mapError((error) =>
			error._tag === "SchemaError"
				? invalidArgument(
						"action",
						`repos_manage ${params.action}: ${ToolFailure.truncate(error.message, ToolFailure.ENGINE_ECHO_LIMIT)}`,
						REQUEST_REMEDIATION,
					)
				: mapEngineError(params.cwd ?? fallbackCwd, REMEDIATION)(error),
		),
	);

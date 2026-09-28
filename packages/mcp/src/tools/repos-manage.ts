/**
 * The `repos_manage` MCP tool: one action-discriminated mutating tool
 * covering `sync`, `pin`, `add`, `note`, `remove`, `rename`, `restore`, and
 * `deregister` against the vendored `.repos/` submodules. Its parameters are
 * a `Schema.Union` of one struct per action, served by `@effected/mcp`'s
 * `McpToolkit.unionTool` as a strict `oneOf` keyed by `action`; the handler
 * receives the decoded member. Mutating — no `readOnlyHint`.
 *
 * @packageDocumentation
 */

import { McpToolkit, ToolOutputSchema, ToolRefusal } from "@effected/mcp";
import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Result, Schema } from "effect";
import { Tool } from "effect/ai";
import { McpToolError, mapEngineError } from "../errors.js";

/** The optional `cwd` every action takes. */
const cwd = Schema.optionalKey(
	Schema.String.annotate({ description: "Directory to resolve the workspace root from." }),
);

/** `sync` has no fields of its own. */
const SyncRequest = Schema.Struct({
	action: Schema.Literal("sync"),
	cwd,
}).annotate({ description: "Initialize/reconcile submodules per the manifest." });

/** `pin` requires both `name` and `ref`. */
const PinRequest = Schema.Struct({
	action: Schema.Literal("pin"),
	name: Schema.String.annotate({ description: "Repo name to re-pin." }),
	ref: Schema.String.annotate({ description: "Git ref to pin to." }),
	cwd,
}).annotate({ description: "Re-pin a repo to a new ref." });

/**
 * `add` requires `url`/`ref`/`purpose`; `name`, `sparse` and `orientation`
 * are optional. `orientation` is what makes a re-vendor lossless — pass back
 * the block a preceding `remove` reported.
 */
const AddRequest = Schema.Struct({
	action: Schema.Literal("add"),
	url: Schema.String.annotate({ description: "Repo URL to vendor." }),
	ref: Schema.String.annotate({ description: "Git ref to vendor." }),
	purpose: Schema.String.annotate({ description: "One-line purpose for the manifest." }),
	name: Schema.optionalKey(Schema.String.annotate({ description: "Override the repo name." })),
	sparse: Schema.optionalKey(Schema.Array(Schema.String).annotate({ description: "Sparse-checkout patterns." })),
	orientation: Schema.optionalKey(
		Repos.RepoOrientation.annotate({
			description:
				"Orientation block to write. Pass back what a preceding remove reported as removedEntry.orientation — add does NOT restore it on its own, so a re-vendor loses it otherwise.",
		}),
	),
	cwd,
}).annotate({ description: "Vendor a new repo." });

/** The note operation {@link Repos.ReposManager}'s `note` takes. */
type NoteOperation = Parameters<Repos.ReposManager["Service"]["note"]>[2];

/**
 * The note operation a `note` request names, or the reason it is incomplete.
 * The fields each `op` needs are enforced here rather than as three members
 * sharing `action: "note"`, so the served `oneOf` keeps one member per
 * action; the same function is the decode-time filter and the handler's
 * narrowing, so the two cannot disagree.
 */
const noteOperation = (request: {
	readonly op: "add" | "remove" | "promote";
	readonly note?: string;
	readonly id?: string;
	readonly into?: "layout" | "startHere";
}): Result.Result<NoteOperation, string> => {
	switch (request.op) {
		case "add":
			return request.note === undefined
				? Result.fail('note op "add" requires `note`')
				: Result.succeed({ op: "add", note: request.note });
		case "remove":
			return request.id === undefined
				? Result.fail('note op "remove" requires `id`')
				: Result.succeed({ op: "remove", id: request.id });
		case "promote":
			return request.id === undefined || request.into === undefined
				? Result.fail('note op "promote" requires both `id` and `into`')
				: Result.succeed({ op: "promote", id: request.id, into: request.into });
	}
};

/**
 * `note` requires `name` and `op`; the fields required beyond that depend on
 * `op` — enforced by the trailing filter so the decode error names exactly
 * what's missing for the chosen op.
 */
const NoteRequest = Schema.Struct({
	action: Schema.Literal("note"),
	name: Schema.String.annotate({ description: "Repo name the note belongs to." }),
	op: Schema.Literals(["add", "remove", "promote"]).annotate({ description: "Note operation." }),
	note: Schema.optionalKey(Schema.String.annotate({ description: "Note text (op=add)." })),
	id: Schema.optionalKey(Schema.String.annotate({ description: "Note id (op=remove|promote)." })),
	into: Schema.optionalKey(
		Schema.Literals(["layout", "startHere"]).annotate({ description: "Orientation target (op=promote)." }),
	),
	cwd,
})
	.check(
		Schema.makeFilter((request) =>
			Result.match(noteOperation(request), { onFailure: (reason) => reason, onSuccess: () => true }),
		),
	)
	.annotate({ description: "Add, remove or promote an agent note." });

/** `remove` requires only `name`. */
const RemoveRequest = Schema.Struct({
	action: Schema.Literal("remove"),
	name: Schema.String.annotate({ description: "Repo name to unvendor." }),
	cwd,
}).annotate({ description: "Unvendor a repo." });

/** `rename` requires `name` (the old name) and `newName`. */
const RenameRequest = Schema.Struct({
	action: Schema.Literal("rename"),
	name: Schema.String.annotate({ description: "The repo's current name." }),
	newName: Schema.String.annotate({ description: "New repo name." }),
	cwd,
}).annotate({ description: "Rename a vendored repo's manifest key and worktree." });

/** `restore`'s `names` is optional and repeatable, mirroring `add`'s `sparse`; omitted means "every dirty entry". */
const RestoreRequest = Schema.Struct({
	action: Schema.Literal("restore"),
	names: Schema.optionalKey(
		Schema.Array(Schema.String).annotate({
			description: "Repo names to restore; omitted restores every dirty repo.",
		}),
	),
	cwd,
}).annotate({ description: "Hard-reset worktrees back to their pinned gitlink commits." });

/**
 * `deregister` requires `section` — the stale registration name exactly as the
 * drift report states it (e.g. `.repos/old-name`); the `submodule.` prefix is
 * implied, never passed.
 */
const DeregisterRequest = Schema.Struct({
	action: Schema.Literal("deregister"),
	section: Schema.String.annotate({
		description:
			"Stale registration name to clear, exactly as the drift report states it (e.g. .repos/old-name); the submodule. prefix is implied.",
	}),
	cwd,
}).annotate({ description: "Clear a stale submodule registration from local git config." });

/** The `repos_manage` parameters: one struct per action, discriminated by `action`. */
export const ReposManageRequest = Schema.Union([
	SyncRequest,
	PinRequest,
	AddRequest,
	NoteRequest,
	RemoveRequest,
	RenameRequest,
	RestoreRequest,
	DeregisterRequest,
]);
export type ReposManageRequest = typeof ReposManageRequest.Type;

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

/**
 * The `repos_manage` tool result — a discriminated union keyed by `action`,
 * object-rooted so its `outputSchema` is served (every member is a struct).
 */
export const ReposManageResult = ToolOutputSchema.objectRooted(
	Schema.Union([
		ReposManageSyncResult,
		ReposManagePinResult,
		ReposManageAddResult,
		ReposManageNoteResult,
		ReposManageRemoveResult,
		ReposManageRenameResult,
		ReposManageRestoreResult,
		ReposManageDeregisterResult,
	]),
).annotate({
	identifier: "ReposManageResult",
	title: "repos_manage result",
	description: "Result of a mutating repos action: sync, pin, add, note, remove, rename, restore, or deregister.",
});

export type ReposManageResultType = Schema.Schema.Type<typeof ReposManageResult>;

const REMEDIATION = {
	hint: "The mutation did not complete; inspect the vendored-repo state before retrying.",
	suggestedTool: "repos_inspect",
};

const REQUEST_REMEDIATION = {
	hint: "Pass the fields the chosen note op needs: note (op=add), id (op=remove), or id and into (op=promote).",
};

/**
 * Effect handler: resolve the workspace root, then dispatch the decoded
 * request to the matching `ReposManager` method.
 */
export const reposManage = (
	request: ReposManageRequest,
	fallbackCwd: string,
): Effect.Effect<
	ReposManageResultType,
	| Repos.ReposConfigError
	| Repos.GitSubmoduleError
	| Repos.RepoNotFoundError
	| Repos.NoteNotFoundError
	| Repos.ReposLockdownError
	| WorkspaceRootNotFoundError
	| ToolRefusal,
	Repos.ReposManager | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(request.cwd ?? fallbackCwd);
		const manager = yield* Repos.ReposManager;

		switch (request.action) {
			case "sync":
				return { action: "sync" as const, result: yield* manager.sync(root) };
			case "pin":
				return { action: "pin" as const, result: yield* manager.pin(root, request.name, request.ref) };
			case "add": {
				const result = yield* manager.add(root, {
					url: request.url,
					ref: request.ref,
					purpose: request.purpose,
					...(request.name !== undefined ? { name: request.name } : {}),
					...(request.sparse !== undefined ? { sparse: request.sparse } : {}),
					...(request.orientation !== undefined ? { orientation: request.orientation } : {}),
				});
				return { action: "add" as const, result };
			}
			case "note": {
				// The decode filter already refused an incomplete op; this is the
				// same check narrowing the type, so it never refuses a decoded request.
				const operation = noteOperation(request);
				if (Result.isFailure(operation)) {
					return yield* ToolRefusal.refuse(`repos_manage note: ${operation.failure}.`, REQUEST_REMEDIATION);
				}
				return { action: "note" as const, result: yield* manager.note(root, request.name, operation.success) };
			}
			case "remove":
				return { action: "remove" as const, result: yield* manager.remove(root, request.name) };
			case "rename":
				return { action: "rename" as const, result: yield* manager.rename(root, request.name, request.newName) };
			case "restore":
				return { action: "restore" as const, result: yield* manager.restore(root, request.names) };
			case "deregister":
				return { action: "deregister" as const, result: yield* manager.deregister(root, request.section) };
		}
	});

/**
 * The `repos_manage` tool value: a `McpToolkit.unionTool`, so the served input
 * schema is the request union's strict `oneOf` keyed by `action`, and a bad
 * call is rejected as invalid parameters before the handler runs. Mutating:
 * not read-only, not idempotent.
 */
export const reposManageTool = McpToolkit.unionTool("repos_manage", {
	description:
		"Mutating: sync (initialize/reconcile submodules per the manifest), pin (re-pin a repo to a new ref), add (vendor a new repo), note (add/remove/promote an agent note), remove (unvendor a repo), rename (rename a vendored repo's manifest key and worktree), restore (hard-reset a repo's worktree back to its pinned gitlink commit and re-apply sparse paths — DESTRUCTIVE to uncommitted worktree edits; never run implicitly), or deregister (clear a STALE submodule.<section> registration from the superproject's local git config — the phantom entry repos_inspect drift reports as localRegistrationDivergence with no matching manifest entry; refuses a section outside .repos/ and any section still backing a live manifest entry — canonically named or gitdir-diverged — and touches local config only, so nothing is staged). Pass action plus the fields that action needs: pin needs name+ref; add needs url+ref+purpose (name/sparse/orientation optional — pass orientation back from a preceding remove's removedEntry to make a re-vendor lossless); note needs name+op, plus note (op=add), id (op=remove), or id+into (op=promote); remove needs name; rename needs name (the old name) + newName; restore takes an optional names list — omitted, it restores every dirty repo and reports the clean ones as skipped; given, it restores exactly those repos even if already clean; deregister needs section (the registration name exactly as the drift report states it, e.g. .repos/old-name — no submodule. prefix). Each action's fields are served as one member of a strict oneOf keyed by action; a missing field or a key the chosen action does not take is rejected as invalid parameters naming it. The pin result surfaces commitMessage and staleNoteIds — review and commit after pinning. The remove result surfaces commitMessage, removedNotes and the removed entry's orientation block — promote any durable notes elsewhere, keep the orientation if you intend to re-vendor, then review and commit. The rename result surfaces commitMessage — review and commit after renaming. The restore result names exactly what was discarded. The deregister result lists the config keys the removed section carried — nothing to commit afterwards. Returns a typed object in structuredContent (content[] carries the same object as JSON).",
	parameters: ReposManageRequest,
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
 * Wire handler: `McpToolkit.unionHandler` decodes the raw payload into one
 * {@link ReposManageRequest} member (an unknown key or a missing field fails
 * `InvalidParams`, as a `Tool.make` decode failure does), then
 * {@link reposManage} runs with its engine errors mapped onto
 * {@link McpToolError} through {@link mapEngineError}.
 */
export const handleReposManage = (fallbackCwd: string) =>
	McpToolkit.unionHandler(reposManageTool, (request) =>
		reposManage(request, fallbackCwd).pipe(
			Effect.mapError((error) =>
				error._tag === "ToolRefusal" ? error : mapEngineError(request.cwd ?? fallbackCwd, REMEDIATION)(error),
			),
		),
	);

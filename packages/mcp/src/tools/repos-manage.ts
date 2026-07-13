/**
 * The `repos_manage` MCP tool: one action-discriminated mutating tool
 * covering `sync`, `pin`, `add`, and `note` against the vendored `.repos/`
 * submodules. The wire schema is flat (no `oneOf`); the handler maps it into
 * an internal `Schema.TaggedStruct` request union that names the missing
 * field per action on decode failure. Mutating — no `readOnlyHint`.
 *
 * @packageDocumentation
 */

import { Repos } from "@savvy-web/silk-effects";
import { Effect, ParseResult, Schema } from "effect";
import type { WorkspaceRootNotFoundError } from "workspaces-effect";
import { WorkspaceRoot } from "workspaces-effect";

/** `sync` has no extra fields. */
const SyncRequest = Schema.TaggedStruct("sync", {});

/** `pin` requires both `name` and `ref`. */
const PinRequest = Schema.TaggedStruct("pin", {
	name: Schema.String,
	ref: Schema.String,
});

/** `add` requires `url`/`ref`/`purpose`; `name` and `sparse` are optional. */
const AddRequest = Schema.TaggedStruct("add", {
	url: Schema.String,
	ref: Schema.String,
	purpose: Schema.String,
	name: Schema.optional(Schema.String),
	sparse: Schema.optional(Schema.Array(Schema.String)),
});

/**
 * `note` requires `name` and `op`; the fields required beyond that depend on
 * `op` — enforced by the trailing filter so the decode error names exactly
 * what's missing for the chosen op.
 */
const NoteRequest = Schema.TaggedStruct("note", {
	name: Schema.String,
	op: Schema.Literal("add", "remove", "promote"),
	note: Schema.optional(Schema.String),
	id: Schema.optional(Schema.String),
	into: Schema.optional(Schema.Literal("layout", "startHere")),
}).pipe(
	Schema.filter((request) => {
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

/** Internal tagged-union request the flat wire args decode into. */
const ReposManageRequest = Schema.Union(SyncRequest, PinRequest, AddRequest, NoteRequest);

/** `sync` result variant. */
export const ReposManageSyncResult = Schema.Struct({
	action: Schema.Literal("sync"),
	result: Repos.ReposSyncReport,
}).annotations({ identifier: "ReposManageSyncResult" });

/** `pin` result variant. */
export const ReposManagePinResult = Schema.Struct({
	action: Schema.Literal("pin"),
	result: Repos.ReposPinResult,
}).annotations({ identifier: "ReposManagePinResult" });

/** `add` result variant. */
export const ReposManageAddResult = Schema.Struct({
	action: Schema.Literal("add"),
	result: Repos.ReposAddResult,
}).annotations({ identifier: "ReposManageAddResult" });

/** `note` result variant. */
export const ReposManageNoteResult = Schema.Struct({
	action: Schema.Literal("note"),
	result: Repos.ReposNoteResult,
}).annotations({ identifier: "ReposManageNoteResult" });

/** The `repos_manage` tool result — a discriminated union keyed by `action`. */
export const ReposManageResult = Schema.Union(
	ReposManageSyncResult,
	ReposManagePinResult,
	ReposManageAddResult,
	ReposManageNoteResult,
).annotations({
	identifier: "ReposManageResult",
	title: "repos_manage result",
	description: "Result of a mutating repos action: sync, pin, add, or note.",
});

export type ReposManageResultType = Schema.Schema.Type<typeof ReposManageResult>;

/**
 * Render a repo-derived value as an inert markdown code span. Escapes
 * backticks and backslashes so vendored-repo content (names, refs, purposes,
 * commit messages, note text) — the definition of untrusted input — cannot
 * inject markdown structure into the transcript an agent reads.
 */
const mdInline = (value: string): string => `\`${value.replace(/[`\\]/g, "\\$&")}\``;

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
	}
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ReposManageAsMarkdown = Schema.transformOrFail(ReposManageResult, Schema.String, {
	strict: true,
	decode: (data) => ParseResult.succeed(renderMarkdown(data)),
	encode: (text, _options, ast) =>
		ParseResult.fail(
			new ParseResult.Forbidden(ast, text, "ReposManageAsMarkdown is one-way: markdown cannot be parsed back."),
		),
});

/** Flat wire arguments for the {@link reposManage} handler. */
export interface ReposManageArgs {
	readonly action: "sync" | "pin" | "add" | "note";
	readonly name?: string;
	readonly ref?: string;
	readonly url?: string;
	readonly purpose?: string;
	readonly sparse?: ReadonlyArray<string>;
	readonly op?: "add" | "remove" | "promote";
	readonly note?: string;
	readonly id?: string;
	readonly into?: "layout" | "startHere";
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
	| ParseResult.ParseError
	| WorkspaceRootNotFoundError,
	Repos.ReposManager | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		const manager = yield* Repos.ReposManager;

		const { action, cwd: _cwd, ...rest } = args;
		const request = yield* Schema.decodeUnknown(ReposManageRequest)({ _tag: action, ...rest });

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
		}
	});

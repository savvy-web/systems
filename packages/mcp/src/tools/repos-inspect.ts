/**
 * The `repos_inspect` MCP tool: a discriminated-union result keyed by `mode`
 * (status | config), each variant embedding the corresponding resolved-output
 * schema from silk-effects' Repos namespace, plus a one-way markdown
 * transform. Read-only.
 *
 * @packageDocumentation
 */

import type { GitmodulesEntry } from "@effected/git";
import { Gitmodules } from "@effected/git";
import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, FileSystem, Option, Path, Result, Schema, SchemaGetter } from "effect";
import { mdInline } from "./md-inline.js";

/** One `.gitmodules` submodule section, decoded into typed fields. */
const GitmodulesEntrySchema = Schema.Struct({
	name: Schema.String,
	path: Schema.String,
	url: Schema.String,
	branch: Schema.optionalKey(Schema.String),
	shallow: Schema.optionalKey(Schema.Boolean),
	update: Schema.optionalKey(Schema.String),
	ignore: Schema.optionalKey(Schema.Literals(["all", "dirty", "untracked", "none"])),
	fetchRecurseSubmodules: Schema.optionalKey(Schema.Union([Schema.Boolean, Schema.Literal("on-demand")])),
}).annotate({ identifier: "GitmodulesEntry" });

/** Status-report variant. */
export const ReposStatusResult = Schema.Struct({
	mode: Schema.Literal("status"),
	result: Repos.ReposStatusReport,
}).annotate({ identifier: "ReposStatusResult" });

/** Manifest-config variant. */
export const ReposConfigResult = Schema.Struct({
	mode: Schema.Literal("config"),
	result: Repos.ReposManifestFile,
}).annotate({ identifier: "ReposConfigResult" });

/** Four-authority drift-reconciliation variant. */
export const ReposDriftResult = Schema.Struct({
	mode: Schema.Literal("drift"),
	report: Repos.ReposDriftReport,
}).annotate({ identifier: "ReposDriftResult" });

/** Raw `.gitmodules` variant: the decoded submodule sections, or a parse error. */
export const ReposGitmodulesResult = Schema.Struct({
	mode: Schema.Literal("gitmodules"),
	entries: Schema.Array(GitmodulesEntrySchema),
	parseError: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "ReposGitmodulesResult" });

/** The `repos_inspect` tool result — a discriminated union keyed by `mode`. */
export const ReposInspectResult = Schema.Union([
	ReposStatusResult,
	ReposConfigResult,
	ReposDriftResult,
	ReposGitmodulesResult,
]).annotate({
	identifier: "ReposInspectResult",
	title: "repos_inspect result",
	description:
		"Drift report (status), the parsed manifest (config), the four-authority reconciliation report (drift), or the decoded .gitmodules sections (gitmodules).",
});

export type ReposInspectResultType = Schema.Schema.Type<typeof ReposInspectResult>;

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: ReposInspectResultType): string => {
	switch (data.mode) {
		case "status": {
			const r = data.result;
			const lines = [`# repos status`, ``, `clean: ${r.clean}`, ``, `## Repos`];
			for (const entry of r.repos) {
				lines.push(
					`### ${mdInline(entry.name)}`,
					`- ref: ${mdInline(entry.ref)}`,
					`- purpose: ${mdInline(entry.purpose)}`,
					`- present: ${entry.present}`,
					`- commit: ${entry.commit ? mdInline(entry.commit) : "(none)"}`,
					`- stagedCommit: ${entry.stagedCommit ? mdInline(entry.stagedCommit) : "(none)"}`,
					`- committedCommit: ${entry.committedCommit ? mdInline(entry.committedCommit) : "(none)"}`,
					`- checkedOutCommit: ${entry.checkedOutCommit ? mdInline(entry.checkedOutCommit) : "(none)"}`,
					`- dirty: ${entry.dirty}`,
				);
				if (entry.staleNoteIds.length > 0) {
					lines.push(`- staleNoteIds: ${entry.staleNoteIds.map(mdInline).join(", ")}`);
				}
			}
			if (r.repos.length === 0) lines.push("(none)");
			return lines.join("\n");
		}
		case "config": {
			const r = data.result;
			const lines = [`# repos config`, ``, `## Repos`];
			for (const [name, entry] of Object.entries(r.repos)) {
				lines.push(
					`### ${mdInline(name)}`,
					`- url: ${mdInline(entry.url)}`,
					`- ref: ${mdInline(entry.ref)}`,
					`- purpose: ${mdInline(entry.purpose)}`,
				);
				if (entry.sparse && entry.sparse.length > 0) {
					lines.push(`- sparse: ${entry.sparse.map(mdInline).join(", ")}`);
				}
				if (entry.orientation) {
					const o = entry.orientation;
					if (o.layout) lines.push(`- layout: ${mdInline(o.layout)}`);
					if (o.startHere) lines.push(`- startHere: ${mdInline(o.startHere)}`);
					if (o.keyPaths) {
						lines.push(`- keyPaths:`);
						for (const [key, value] of Object.entries(o.keyPaths)) {
							lines.push(`  - ${mdInline(key)}: ${mdInline(value)}`);
						}
					}
				}
				if (entry.notes && entry.notes.length > 0) {
					lines.push(`- notes:`);
					for (const note of entry.notes) {
						lines.push(
							`  - ${mdInline(note.id)} (${mdInline(note.date)}, ref ${mdInline(note.ref)}): ${mdInline(note.note)}`,
						);
					}
				}
			}
			if (Object.keys(r.repos).length === 0) lines.push("(none)");
			return lines.join("\n");
		}
		case "drift": {
			const r = data.report;
			const lines = [`# repos drift`, ``, `clean: ${r.clean}`, ``, `| name | kind | detail |`, `| --- | --- | --- |`];
			for (const d of r.drifts) {
				lines.push(`| ${mdInline(d.name)} | ${mdInline(d.kind)} | ${mdInline(d.detail)} |`);
			}
			if (r.drifts.length === 0) lines.push(``, `(none)`);
			return lines.join("\n");
		}
		case "gitmodules": {
			const lines = [`# repos gitmodules`, ``];
			if (data.parseError) {
				lines.push(`parse error: ${mdInline(data.parseError)}`, ``);
			}
			lines.push(`| name | path | url | branch | shallow |`, `| --- | --- | --- | --- | --- |`);
			for (const entry of data.entries) {
				lines.push(
					`| ${mdInline(entry.name)} | ${mdInline(entry.path)} | ${mdInline(entry.url)} | ${
						entry.branch === undefined ? "(none)" : mdInline(entry.branch)
					} | ${entry.shallow === undefined ? "(unset)" : entry.shallow} |`,
				);
			}
			if (data.entries.length === 0) lines.push(``, `(none)`);
			return lines.join("\n");
		}
	}
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ReposInspectAsMarkdown = ReposInspectResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "ReposInspectAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

/** Arguments for the {@link reposInspect} handler. */
export interface ReposInspectArgs {
	readonly mode: "status" | "config" | "drift" | "gitmodules";
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root, then dispatch to the matching
 * Repos service keyed by `mode`. Mirrors `changesetInspect`.
 */
export const reposInspect = (
	args: ReposInspectArgs,
	fallbackCwd: string,
): Effect.Effect<
	ReposInspectResultType,
	Repos.ReposConfigError | Repos.GitSubmoduleError | WorkspaceRootNotFoundError,
	Repos.ReposManager | Repos.ReposConfigStore | Repos.ReposDrift | WorkspaceRoot | FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);

		switch (args.mode) {
			case "status": {
				const manager = yield* Repos.ReposManager;
				const result = yield* manager.status(root);
				return { mode: "status", result } as ReposInspectResultType;
			}
			case "config": {
				const configStore = yield* Repos.ReposConfigStore;
				const result = yield* configStore.read(root);
				return { mode: "config", result } as ReposInspectResultType;
			}
			case "drift": {
				const drift = yield* Repos.ReposDrift;
				const report = yield* drift.check(root);
				return { mode: "drift", report } as ReposInspectResultType;
			}
			case "gitmodules": {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				// Absence is empty submodule state, not a failure — a workspace with
				// no vendored repos yet has none. Mirrors `ReposDrift.check`
				// (drift.ts) exactly.
				const text = yield* fs.readFileString(path.join(root, ".gitmodules")).pipe(Effect.option);
				if (Option.isNone(text)) {
					return { mode: "gitmodules", entries: [] } as ReposInspectResultType;
				}
				const parsed = Gitmodules.parseResult(text.value);
				if (Result.isFailure(parsed)) {
					return { mode: "gitmodules", entries: [], parseError: parsed.failure.message } as ReposInspectResultType;
				}
				const entries: ReadonlyArray<GitmodulesEntry> = parsed.success.entries;
				return { mode: "gitmodules", entries } as ReposInspectResultType;
			}
		}
	});

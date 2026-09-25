/**
 * The `repos_inspect` MCP tool: a discriminated-union result keyed by `mode`
 * (status | config), each variant embedding the corresponding resolved-output
 * schema from silk-effects' Repos namespace. Read-only.
 *
 * @packageDocumentation
 */

import { Gitmodules } from "@effected/git";
import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, FileSystem, Option, Path, Result, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, mapEngineError } from "../errors.js";

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
		"Drift report (status), the parsed manifest (config), the five-authority reconciliation report (drift), or the decoded .gitmodules sections (gitmodules).",
});

export type ReposInspectResultType = Schema.Schema.Type<typeof ReposInspectResult>;

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
				const gitmodulesPath = path.join(root, ".gitmodules");
				// Absence is empty submodule state, not a failure — a workspace with
				// no vendored repos yet has none. Only a `NotFound`-classified read
				// failure means "absent," mirroring `ReposDrift.check`'s fix
				// (drift.ts): a permission-denied stat or any other read failure is a
				// real problem and must propagate typed, not collapse into an empty
				// report via `Effect.option`.
				const text = yield* fs.readFileString(gitmodulesPath).pipe(
					Effect.map(Option.some),
					Effect.catchTag("PlatformError", (error) =>
						error.reason._tag === "NotFound"
							? Effect.succeed(Option.none<string>())
							: Effect.fail(
									new Repos.GitSubmoduleError({
										command: "read .gitmodules",
										cwd: gitmodulesPath,
										reason: error.message,
									}),
								),
					),
				);
				if (Option.isNone(text)) {
					return { mode: "gitmodules", entries: [] } as ReposInspectResultType;
				}
				const parsed = Gitmodules.parseResult(text.value);
				if (Result.isFailure(parsed)) {
					return { mode: "gitmodules", entries: [], parseError: parsed.failure.message } as ReposInspectResultType;
				}
				// Decode for real rather than force-casting: `parsed.success.entries`
				// is the kit's own `GitmodulesEntry[]`, structurally close enough to
				// `GitmodulesEntrySchema` that a bare `as` would keep compiling even
				// if `@effected/git` renamed or added a field, surfacing only as
				// silently wrong output (a missing field reading back
				// `undefined`) instead of a decode error naming the
				// mismatch. `parseError` already gives decode failures a home.
				const decoded = Schema.decodeUnknownResult(Schema.Array(GitmodulesEntrySchema))(parsed.success.entries);
				if (Result.isFailure(decoded)) {
					return {
						mode: "gitmodules",
						entries: [],
						parseError: `unexpected .gitmodules entry shape: ${decoded.failure.message}`,
					} as ReposInspectResultType;
				}
				return { mode: "gitmodules", entries: decoded.success } as ReposInspectResultType;
			}
		}
	});

/**
 * The `repos_inspect` wire-level `mode` enum. Exported so tests can assert
 * the boundary rejects an unknown mode without duplicating the member list.
 */
export const ReposInspectMode = Schema.Literals(["status", "config", "drift", "gitmodules"]).annotate({
	description:
		"status = drift report; config = the full agent brief; drift = five-authority submodule reconciliation; gitmodules = decoded .gitmodules sections.",
});

/** Wire parameters for `repos_inspect`. */
export const ReposInspectParams = Schema.Struct({
	mode: ReposInspectMode,
	cwd: Schema.optionalKey(Schema.String.annotate({ description: "Directory to resolve the workspace root from." })),
});
export type ReposInspectParams = typeof ReposInspectParams.Type;

const REMEDIATION = {
	hint: "The vendored-repo state could not be read; check .repos/config.json and .gitmodules, and that git can run in the workspace.",
};

/** The `repos_inspect` tool value. */
export const reposInspectTool = Tool.make("repos_inspect", {
	description:
		"Read-only: drift report or parsed .repos/config.json manifest with orientation and notes. mode=status is the per-repo drift summary from ReposManager (present/dirty/commit); mode=config is the parsed manifest; mode=drift reconciles all four submodule authorities (manifest, .gitmodules, worktree, git submodule status) and reports every disagreement; mode=gitmodules decodes the raw .gitmodules file's submodule sections. Returns a typed object in structuredContent (content[] carries the same object as JSON).",
	parameters: ReposInspectParams,
	success: ReposInspectResult,
	failure: McpToolError,
	dependencies: [
		Repos.ReposManager,
		Repos.ReposConfigStore,
		Repos.ReposDrift,
		WorkspaceRoot,
		FileSystem.FileSystem,
		Path.Path,
	],
})
	.annotate(Tool.Title, "Inspect vendored repos")
	.annotate(Tool.Readonly, true)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, true)
	.annotate(Tool.OpenWorld, false);

/** Wire handler: {@link reposInspect} with its error channel mapped onto {@link McpToolError}. */
export const handleReposInspect = (fallbackCwd: string, params: ReposInspectParams) =>
	reposInspect(params, fallbackCwd).pipe(Effect.mapError(mapEngineError(params.cwd ?? fallbackCwd, REMEDIATION)));

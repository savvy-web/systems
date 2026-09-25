/**
 * The `changeset_inspect` MCP tool: a discriminated-union result keyed by `mode`
 * (branch | config), each variant embedding the corresponding resolved-output
 * schema from silk-effects' Changesets namespace. Read-only.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, mapEngineError } from "../errors.js";

/** Branch-analysis variant. */
export const ChangesetBranchResult = Schema.Struct({
	mode: Schema.Literal("branch"),
	result: Changesets.BranchAnalysisSchema,
}).annotate({ identifier: "ChangesetBranchResult" });

/** Config-inspection variant. */
export const ChangesetConfigResult = Schema.Struct({
	mode: Schema.Literal("config"),
	result: Changesets.InspectedConfigSchema,
}).annotate({ identifier: "ChangesetConfigResult" });

/** Classify variant — arbitrary paths to owning package. */
export const ChangesetClassifyResult = Schema.Struct({
	mode: Schema.Literal("classify"),
	result: Schema.Array(Changesets.ClassificationSchema),
}).annotate({ identifier: "ChangesetClassifyResult" });

/** The `changeset_inspect` tool result — a discriminated union keyed by `mode`. */
export const ChangesetInspectResult = Schema.Union([
	ChangesetBranchResult,
	ChangesetConfigResult,
	ChangesetClassifyResult,
]).annotate({
	identifier: "ChangesetInspectResult",
	title: "changeset_inspect result",
	description: "Read-only changeset analysis grouped by mode (branch | config | classify).",
});

export type ChangesetInspectResultType = Schema.Schema.Type<typeof ChangesetInspectResult>;

/** Arguments for the {@link changesetInspect} handler. */
export interface ChangesetInspectArgs {
	readonly mode: "branch" | "config" | "classify";
	readonly base?: string;
	readonly paths?: ReadonlyArray<string>;
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root, then dispatch to the matching
 * Changesets service keyed by `mode`. Mirrors `turboInspect`.
 */
export const changesetInspect = (
	args: ChangesetInspectArgs,
	fallbackCwd: string,
): Effect.Effect<
	ChangesetInspectResultType,
	Changesets.ConfigurationError | Changesets.GitError | WorkspaceRootNotFoundError,
	Changesets.BranchAnalyzer | Changesets.ConfigInspector | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);

		// The MCP server holds one ConfigInspector for its whole process
		// lifetime (#229). Its cache never expires on its own, so every tool
		// call must refresh it first to observe on-disk edits made since the
		// last call — covers all three modes, since branch mode's
		// BranchAnalyzer also reads through this same shared inspector.
		// Per-ROOT refresh: this call inspects exactly `root`, and the
		// inspector reads workspace membership per call root, so refreshing
		// only that root leaves sibling worktrees' still-valid caches intact.
		const inspector = yield* Changesets.ConfigInspector;
		yield* inspector.refreshIn(root);

		switch (args.mode) {
			case "branch": {
				const analyzer = yield* Changesets.BranchAnalyzer;
				const result = yield* analyzer.analyzeBranch(root, args.base ? { baseBranch: args.base } : undefined);
				return { mode: "branch", result } as ChangesetInspectResultType;
			}
			case "config": {
				const result = yield* inspector.inspect(root);
				return { mode: "config", result } as ChangesetInspectResultType;
			}
			case "classify": {
				const result = yield* inspector.classify(root, args.paths ?? []);
				return { mode: "classify", result } as ChangesetInspectResultType;
			}
		}
	});

/** Wire parameters for `changeset_inspect`. */
export const ChangesetInspectParams = Schema.Struct({
	mode: Schema.Literals(["branch", "config", "classify"]).annotate({ description: "Which inspection to run." }),
	base: Schema.optionalKey(Schema.String.annotate({ description: "Override the base branch (branch mode only)." })),
	paths: Schema.optionalKey(
		Schema.Array(Schema.String).annotate({ description: "Paths to classify (classify mode only)." }),
	),
	cwd: Schema.optionalKey(Schema.String.annotate({ description: "Directory to resolve the workspace root from." })),
});
export type ChangesetInspectParams = typeof ChangesetInspectParams.Type;

const REMEDIATION = {
	hint: "Check .changeset/config.json and that the base branch exists locally (fetch it if the merge base cannot be computed).",
	suggestedTool: "changeset_inspect",
};

/** The `changeset_inspect` tool value. */
export const changesetInspectTool = Tool.make("changeset_inspect", {
	description:
		"Read-only changeset analysis for the changeset-manager workflow. mode=branch diffs the current branch against its base and classifies every changed file by owning package (with packagesAffected and the unmapped paths to ask the user about; an unmapped path may carry a machine-readable unmappedHint reason — e.g. a deleted versionFiles/additionalScopes target or a known template mirror — meaning it is probably already accounted for). mode=config surfaces the resolved .changeset/config.json (release surfaces, versionFiles, ignore list). mode=classify maps arbitrary repo-relative paths to their owning package. Prefer this over shelling out to the savvy CLI. Returns a typed object in structuredContent (content[] carries the same object as JSON).",
	parameters: ChangesetInspectParams,
	success: ChangesetInspectResult,
	failure: McpToolError,
	dependencies: [Changesets.BranchAnalyzer, Changesets.ConfigInspector, WorkspaceRoot],
})
	.annotate(Tool.Title, "Inspect changesets")
	.annotate(Tool.Readonly, true)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, true)
	.annotate(Tool.OpenWorld, false);

/** Wire handler: {@link changesetInspect} with its error channel mapped onto {@link McpToolError}. */
export const handleChangesetInspect = (fallbackCwd: string, params: ChangesetInspectParams) =>
	changesetInspect(params, fallbackCwd).pipe(Effect.mapError(mapEngineError(params.cwd ?? fallbackCwd, REMEDIATION)));

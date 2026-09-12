/**
 * The `changeset_inspect` MCP tool: a discriminated-union result keyed by `mode`
 * (branch | config), each variant embedding the corresponding resolved-output
 * schema from silk-effects' Changesets namespace, plus a one-way markdown
 * transform. Read-only.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Schema, SchemaGetter } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, mapEngineError } from "../errors.js";
import { SilkMarkdown } from "../markdown.js";

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

/**
 * Render a repo/config-derived value as an inert markdown code span. Escapes
 * backticks and backslashes so a crafted filename or package name cannot inject
 * markdown structure into the transcript that an agent reads.
 */
const mdInline = (value: string): string => `\`${value.replace(/[`\\]/g, "\\$&")}\``;

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: ChangesetInspectResultType): string => {
	switch (data.mode) {
		case "branch": {
			const r = data.result;
			const lines = [
				`# changeset branch analysis — base ${mdInline(r.baseBranch)}`,
				``,
				`merge base: ${mdInline(r.mergeBaseSha)}`,
				``,
				`## Packages affected`,
				r.packagesAffected.map((p) => `- ${mdInline(p)}`).join("\n") || "(none)",
				``,
				`## Files`,
			];
			for (const f of r.files) {
				const owner = f.package ? mdInline(f.package) : mdInline("<unmapped>");
				lines.push(`- ${mdInline(f.status)}  ${mdInline(f.path)}  ->  ${owner}`);
			}
			if (r.unmappedFiles.length > 0) {
				// A hinted unmapped file (#290) is probably already accounted for —
				// surface the hint so the agent can classify without a manual diff.
				const hints = new Map<string, string>();
				for (const f of r.files) {
					if (typeof f.reason === "object" && f.reason !== null && f.reason.kind === "unmappedHint") {
						hints.set(f.path, f.reason.hint);
					}
				}
				lines.push(``, `## Unmapped (ask the user)`);
				for (const p of r.unmappedFiles) {
					const hint = hints.get(p);
					lines.push(hint === undefined ? `- ${mdInline(p)}` : `- ${mdInline(p)} — ${mdInline(hint)}`);
				}
			}
			return lines.join("\n");
		}
		case "config": {
			const r = data.result;
			const lines = [
				`# changeset config — ${mdInline(r.configPath)}`,
				``,
				`base branch: ${mdInline(r.baseBranch)}`,
				`access: ${r.access}`,
				`changelog: ${r.changelog ? mdInline(r.changelog) : "(none)"}`,
				`ignored: ${r.ignore.map(mdInline).join(", ") || "(none)"}`,
				``,
				`## Packages`,
			];
			for (const p of r.packages) {
				lines.push(
					p.version === undefined ? `### ${mdInline(p.name)}` : `### ${mdInline(p.name)} (${mdInline(p.version)})`,
					`- dir: ${mdInline(p.workspaceDir)}`,
				);
				if (p.additionalScopes.length > 0)
					lines.push(`- additionalScopes: ${p.additionalScopes.map(mdInline).join(", ")}`);
				if (p.versionFiles.length > 0)
					lines.push(`- versionFiles: ${p.versionFiles.map((v) => mdInline(v.glob)).join(", ")}`);
			}
			if (r.packages.length === 0) lines.push("(none resolved)");
			return lines.join("\n");
		}
		case "classify": {
			const lines = [`# changeset classify`, ``];
			for (const c of data.result) {
				const owner = c.package ? mdInline(c.package) : mdInline("<unmapped>");
				const hint =
					typeof c.reason === "object" && c.reason !== null && c.reason.kind === "unmappedHint"
						? ` — ${mdInline(c.reason.hint)}`
						: "";
				lines.push(`- ${mdInline(c.path)}  ->  ${owner}${hint}`);
			}
			if (data.result.length === 0) lines.push("(no paths)");
			return lines.join("\n");
		}
	}
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ChangesetInspectAsMarkdown = ChangesetInspectResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "ChangesetInspectAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

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
		"Read-only changeset analysis for the changeset-manager workflow. mode=branch diffs the current branch against its base and classifies every changed file by owning package (with packagesAffected and the unmapped paths to ask the user about; an unmapped path may carry a machine-readable unmappedHint reason — e.g. a deleted versionFiles/additionalScopes target or a known template mirror — meaning it is probably already accounted for). mode=config surfaces the resolved .changeset/config.json (release surfaces, versionFiles, ignore list). mode=classify maps arbitrary repo-relative paths to their owning package. Prefer this over shelling out to the savvy CLI.",
	parameters: ChangesetInspectParams,
	success: ChangesetInspectResult,
	failure: McpToolError,
	dependencies: [Changesets.BranchAnalyzer, Changesets.ConfigInspector, WorkspaceRoot],
})
	.annotate(Tool.Title, "Inspect changesets")
	.annotate(Tool.Readonly, true)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, true)
	.annotate(Tool.OpenWorld, false)
	.annotate(SilkMarkdown, Schema.decodeUnknownSync(ChangesetInspectAsMarkdown));

/** Wire handler: {@link changesetInspect} with its error channel mapped onto {@link McpToolError}. */
export const handleChangesetInspect = (fallbackCwd: string, params: ChangesetInspectParams) =>
	changesetInspect(params, fallbackCwd).pipe(Effect.mapError(mapEngineError(params.cwd ?? fallbackCwd, REMEDIATION)));

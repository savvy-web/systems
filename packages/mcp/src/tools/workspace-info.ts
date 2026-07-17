/**
 * The `workspace_info` MCP tool: schema, projection mapper, transcript, and
 * the Effect handler over {@link SilkWorkspaceAnalyzer}.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import type { AnalyzedWorkspace, WorkspaceAnalysis, WorkspaceAnalysisError } from "@savvy-web/silk-effects";
import { SilkWorkspaceAnalyzer } from "@savvy-web/silk-effects";
import { Effect, Schema, SchemaGetter } from "effect";

/** A flattened, non-recursive summary of one analyzed workspace. */
export const WorkspaceSummary = Schema.Struct({
	name: Schema.String,
	version: Schema.String,
	path: Schema.String,
	root: Schema.Boolean,
	publishable: Schema.Boolean,
	targets: Schema.Array(Schema.String).annotate({ description: "Publish registry URLs." }),
	versioned: Schema.Boolean,
	tagged: Schema.Boolean,
	released: Schema.Boolean,
	linked: Schema.Array(Schema.String).annotate({ description: "Names of linked workspaces." }),
	fixed: Schema.Array(Schema.String).annotate({ description: "Names of fixed-group siblings." }),
}).annotate({ identifier: "WorkspaceSummary" });

/** The `workspace_info` tool result — a projection of `WorkspaceAnalysis`. */
export const WorkspaceInfoResult = Schema.Struct({
	root: Schema.String,
	runtime: Schema.Literals(["node", "bun"]),
	packageManager: Schema.Struct({
		type: Schema.Literals(["npm", "pnpm", "yarn", "bun"]),
		version: Schema.optional(Schema.String),
	}),
	workspaceCount: Schema.Number,
	workspaces: Schema.Array(WorkspaceSummary),
}).annotate({
	identifier: "WorkspaceInfoResult",
	title: "workspace_info result",
	description:
		"Structured snapshot of the Silk workspace: runtime, package manager, and a per-workspace summary (publishability, versioning, tag/release state, linked/fixed relations).",
});

export type WorkspaceInfoResultType = Schema.Schema.Type<typeof WorkspaceInfoResult>;

const toSummary = (w: AnalyzedWorkspace): Schema.Schema.Type<typeof WorkspaceSummary> => ({
	name: w.name,
	version: w.version.current,
	path: w.path,
	root: w.root,
	publishable: w.publishable,
	targets: w.targets.map((t) => t.registry),
	versioned: w.versioned,
	tagged: w.tagged,
	released: w.released,
	linked: (w.linked as AnalyzedWorkspace[]).map((l) => l.name),
	fixed: (w.fixed as AnalyzedWorkspace[]).map((f) => f.name),
});

/** Project a full `WorkspaceAnalysis` to the flat tool result. */
export const toWorkspaceInfoResult = (analysis: WorkspaceAnalysis): WorkspaceInfoResultType => ({
	root: analysis.root,
	runtime: analysis.runtime,
	packageManager: {
		type: analysis.packageManager.type,
		...(analysis.packageManager.version !== undefined ? { version: analysis.packageManager.version } : {}),
	},
	workspaceCount: analysis.workspaces.length,
	workspaces: analysis.workspaces.map(toSummary),
});

/** Render the structured result as a markdown transcript. */
export const formatWorkspaceInfoMarkdown = (data: WorkspaceInfoResultType): string => {
	const pm = data.packageManager.version
		? `${data.packageManager.type}@${data.packageManager.version}`
		: data.packageManager.type;
	const lines: string[] = [
		`# Workspace: ${data.root}`,
		"",
		`- runtime: ${data.runtime}`,
		`- package manager: ${pm}`,
		`- workspaces: ${data.workspaceCount}`,
		"",
		"| name | version | publishable | versioned | tagged | released |",
		"| --- | --- | --- | --- | --- | --- |",
	];
	for (const w of data.workspaces) {
		lines.push(`| ${w.name} | ${w.version} | ${w.publishable} | ${w.versioned} | ${w.tagged} | ${w.released} |`);
	}
	return lines.join("\n");
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const WorkspaceInfoAsMarkdown = WorkspaceInfoResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(formatWorkspaceInfoMarkdown),
		encode: SchemaGetter.forbidden(() => "WorkspaceInfoAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

/**
 * Effect handler: resolve the workspace root by walking up from `base`, analyze
 * that root, and project to the tool result. Fails with `WorkspaceRootNotFoundError`
 * when `base` is not inside a workspace.
 */
export const workspaceInfo = (
	base: string,
): Effect.Effect<
	WorkspaceInfoResultType,
	WorkspaceAnalysisError | WorkspaceRootNotFoundError,
	SilkWorkspaceAnalyzer | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(base);
		const analyzer = yield* SilkWorkspaceAnalyzer;
		const analysis = yield* analyzer.analyze(root);
		return toWorkspaceInfoResult(analysis);
	});

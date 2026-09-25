/**
 * The `changeset_deps_detect` MCP tool: a read-only preview of the cumulative
 * dependency diff (merge-base → working tree) over silk-effects'
 * `Changesets.DepsRegen.plan`. Returns one entry per affected workspace package
 * — its resolved dependency-table rows (devDependencies retained). Read-only:
 * no changeset file is written or deleted.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, mapEngineError } from "../errors.js";

/** One affected workspace package's resolved dependency diff. */
export const ChangesetDepsDetectPackage = Schema.Struct({
	package: Schema.String,
	relativePath: Schema.String,
	rows: Schema.Array(Changesets.RegenDiffRowSchema),
}).annotate({ identifier: "ChangesetDepsDetectPackage" });

/**
 * An untouched prose-only changeset releasing a package in scope for the run
 * (#279) — informational, so the result accounts for every changeset touching
 * an in-scope package.
 */
export const ChangesetDepsDetectCoexisting = Schema.Struct({
	file: Schema.String,
	packages: Schema.Array(Schema.String),
}).annotate({ identifier: "ChangesetDepsDetectCoexisting" });

/** The `changeset_deps_detect` tool result. */
export const ChangesetDepsDetectResult = Schema.Struct({
	root: Schema.String,
	packages: Schema.Array(ChangesetDepsDetectPackage),
	coexisting: Schema.Array(ChangesetDepsDetectCoexisting).annotate({
		description:
			"Prose-only changesets referencing an in-scope package (no Dependencies section). Informational — a regen " +
			"run would leave these untouched.",
	}),
}).annotate({
	identifier: "ChangesetDepsDetectResult",
	title: "changeset_deps_detect result",
	description: "Read-only per-package dependency diff (devDependencies retained). No files are written.",
});

export type ChangesetDepsDetectResultType = Schema.Schema.Type<typeof ChangesetDepsDetectResult>;

/** Arguments for the {@link changesetDepsDetect} handler. */
export interface ChangesetDepsDetectArgs {
	readonly cwd?: string;
	readonly base?: string;
	readonly package?: string;
	readonly packages?: readonly string[];
	readonly exclude?: readonly string[];
}

/**
 * Effect handler: resolve the workspace root, then compute the cumulative
 * dependency diff via {@link Changesets.DepsRegen.plan} with `includeDevDeps`
 * so devDependency rows are retained. Maps `plan.toWrite` into the structured
 * result. No filesystem mutation happens (no `execute`).
 */
export const changesetDepsDetect = (
	args: ChangesetDepsDetectArgs,
	fallbackCwd: string,
): Effect.Effect<
	ChangesetDepsDetectResultType,
	Changesets.DepsRegenPlanError | WorkspaceRootNotFoundError,
	WorkspaceRoot | Changesets.DepsRegen
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		const service = yield* Changesets.DepsRegen;
		const plan = yield* service.plan({
			cwd: root,
			includeDevDeps: true,
			...(args.base ? { base: args.base } : {}),
			...(args.package ? { package: args.package } : {}),
			...(args.packages && args.packages.length > 0 ? { packages: args.packages } : {}),
			...(args.exclude && args.exclude.length > 0 ? { exclude: args.exclude } : {}),
		});
		return {
			root,
			packages: plan.toWrite.map((entry) => ({
				package: entry.diff.package,
				relativePath: entry.diff.relativePath,
				rows: entry.diff.rows,
			})),
			coexisting: plan.coexisting.map((entry) => ({ file: entry.file, packages: [...entry.packages] })),
		} as ChangesetDepsDetectResultType;
	});

/** Wire parameters for `changeset_deps_detect`. */
export const ChangesetDepsDetectParams = Schema.Struct({
	base: Schema.optionalKey(
		Schema.String.annotate({ description: "Override the base branch used to compute the merge-base." }),
	),
	package: Schema.optionalKey(
		Schema.String.annotate({ description: "Restrict output to a single workspace package." }),
	),
	packages: Schema.optionalKey(
		Schema.Array(Schema.String).annotate({
			description: "Restrict output to these workspace packages (unioned with package).",
		}),
	),
	exclude: Schema.optionalKey(
		Schema.Array(Schema.String).annotate({ description: "Drop these packages from the output entirely." }),
	),
	cwd: Schema.optionalKey(Schema.String.annotate({ description: "Directory to resolve the workspace root from." })),
});
export type ChangesetDepsDetectParams = typeof ChangesetDepsDetectParams.Type;

const REMEDIATION = {
	hint: "The dependency diff could not be planned; check that the base branch exists locally and that every named package is a workspace member.",
	suggestedTool: "workspace_info",
};

/** The `changeset_deps_detect` tool value. */
export const changesetDepsDetectTool = Tool.make("changeset_deps_detect", {
	description:
		"Read-only preview of the cumulative dependency diff (merge-base -> working tree) per workspace package. Returns each affected package's resolved dependency-table rows (catalog:/workspace: specifiers resolved per side; devDependencies retained) as the exact rows a pure-dependency changeset would carry, plus a coexisting list of untouched prose-only changesets that reference an in-scope package (informational — no need to re-list .changeset/). Does NOT write or delete any file. Prefer this over shelling out to savvy changeset deps detect. Returns a typed object in structuredContent (content[] carries the same object as JSON).",
	parameters: ChangesetDepsDetectParams,
	success: ChangesetDepsDetectResult,
	failure: McpToolError,
	dependencies: [WorkspaceRoot, Changesets.DepsRegen],
})
	.annotate(Tool.Title, "Detect dependency changesets")
	.annotate(Tool.Readonly, true)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, true)
	.annotate(Tool.OpenWorld, false);

/** Wire handler: {@link changesetDepsDetect} with its error channel mapped onto {@link McpToolError}. */
export const handleChangesetDepsDetect = (fallbackCwd: string, params: ChangesetDepsDetectParams) =>
	changesetDepsDetect(params, fallbackCwd).pipe(
		Effect.mapError(mapEngineError(params.cwd ?? fallbackCwd, REMEDIATION)),
	);

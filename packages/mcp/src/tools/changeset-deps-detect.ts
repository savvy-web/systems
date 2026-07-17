/**
 * The `changeset_deps_detect` MCP tool: a read-only preview of the cumulative
 * dependency diff (merge-base → working tree) over silk-effects'
 * `Changesets.DepsRegen.plan`. Returns one entry per affected workspace package
 * — its resolved dependency-table rows (devDependencies retained) — plus a
 * one-way markdown transform. Read-only: no changeset file is written or
 * deleted.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Schema, SchemaGetter } from "effect";

/** One affected workspace package's resolved dependency diff. */
export const ChangesetDepsDetectPackage = Schema.Struct({
	package: Schema.String,
	relativePath: Schema.String,
	rows: Schema.Array(Changesets.DependencyTableRowSchema),
}).annotate({ identifier: "ChangesetDepsDetectPackage" });

/** The `changeset_deps_detect` tool result. */
export const ChangesetDepsDetectResult = Schema.Struct({
	root: Schema.String,
	packages: Schema.Array(ChangesetDepsDetectPackage),
}).annotate({
	identifier: "ChangesetDepsDetectResult",
	title: "changeset_deps_detect result",
	description: "Read-only per-package dependency diff (devDependencies retained). No files are written.",
});

export type ChangesetDepsDetectResultType = Schema.Schema.Type<typeof ChangesetDepsDetectResult>;

/**
 * Render a repo-derived value as an inert markdown code span so a crafted path,
 * package, or dependency name cannot inject markdown structure into the
 * transcript an agent reads. Control characters (which would break table rows
 * and headings) are flattened to spaces, table-cell pipes are escaped, and the
 * span is fenced with a backtick run longer than any in the value — CommonMark
 * forbids backslash-escaping a backtick inside a code span.
 */
const mdInline = (value: string): string => {
	// Escape backslashes before pipes so an input `\|` cannot slip a raw pipe past
	// the escape and split the GFM table cell (the table extension un-escapes both).
	const safe = value
		.replace(/\p{Cc}/gu, " ")
		.replace(/\\/g, "\\\\")
		.replace(/\|/g, "\\|");
	const longest = safe.match(/`+/g)?.reduce((m, run) => Math.max(m, run.length), 0) ?? 0;
	const fence = "`".repeat(longest + 1);
	const pad = safe.startsWith("`") || safe.endsWith("`") || safe.trim() === "" ? " " : "";
	return `${fence}${pad}${safe}${pad}${fence}`;
};

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: ChangesetDepsDetectResultType): string => {
	if (data.packages.length === 0) {
		return `# changeset deps detect — ${mdInline(data.root)}\n\nNo dependency changes detected.`;
	}
	const lines = [`# changeset deps detect — ${mdInline(data.root)}`, ``];
	for (const pkg of data.packages) {
		lines.push(`## ${mdInline(pkg.package)} — ${mdInline(pkg.relativePath)}`, ``);
		lines.push(`| Dependency | Type | Action | From | To |`, `| --- | --- | --- | --- | --- |`);
		for (const r of pkg.rows) {
			lines.push(`| ${mdInline(r.dependency)} | ${r.type} | ${r.action} | ${mdInline(r.from)} | ${mdInline(r.to)} |`);
		}
		lines.push(``);
	}
	return lines.join("\n").trimEnd();
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ChangesetDepsDetectAsMarkdown = ChangesetDepsDetectResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "ChangesetDepsDetectAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

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
		} as ChangesetDepsDetectResultType;
	});

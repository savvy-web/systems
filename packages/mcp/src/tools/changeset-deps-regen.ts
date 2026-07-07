/**
 * The `changeset_deps_regen` MCP tool: delete stale pure-dependency changesets
 * and write fresh single-package, patch-bump changesets from the cumulative
 * dependency diff, over silk-effects' `Changesets.DepsRegen`. Mutating (writes
 * and deletes `.changeset/*.md`) unless `dryRun` is set. The second mutating
 * tool after `biome_check`; no `readOnlyHint`.
 *
 * @packageDocumentation
 */

import { Changesets } from "@savvy-web/silk-effects";
import { Effect, ParseResult, Schema } from "effect";
import type { PointInTimeReadError, WorkspaceDiscoveryError, WorkspaceRootNotFoundError } from "workspaces-effect";
import { WorkspaceRoot } from "workspaces-effect";

/** The `changeset_deps_regen` tool result. */
export const ChangesetDepsRegenResult = Schema.Struct({
	root: Schema.String,
	deleted: Schema.Array(Schema.String),
	written: Schema.Array(Schema.String),
	skippedMixed: Schema.Array(Schema.String),
	dryRun: Schema.Boolean,
}).annotations({
	identifier: "ChangesetDepsRegenResult",
	title: "changeset_deps_regen result",
	description: "Regenerated pure-dependency changesets. Mutates .changeset/*.md unless dryRun is set.",
});

export type ChangesetDepsRegenResultType = Schema.Schema.Type<typeof ChangesetDepsRegenResult>;

/**
 * Render a repo-derived value (path) as an inert markdown code span. Control
 * characters are flattened to spaces and the span is fenced with a backtick run
 * longer than any in the value — CommonMark forbids backslash-escaping a
 * backtick inside a code span.
 */
const mdInline = (value: string): string => {
	const safe = value.replace(/\p{Cc}/gu, " ");
	const longest = safe.match(/`+/g)?.reduce((m, run) => Math.max(m, run.length), 0) ?? 0;
	const fence = "`".repeat(longest + 1);
	const pad = safe.startsWith("`") || safe.endsWith("`") || safe.trim() === "" ? " " : "";
	return `${fence}${pad}${safe}${pad}${fence}`;
};

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: ChangesetDepsRegenResultType): string => {
	const heading = `# changeset deps regen — ${mdInline(data.root)}${data.dryRun ? " (dry run)" : ""}`;
	if (data.deleted.length === 0 && data.written.length === 0 && data.skippedMixed.length === 0) {
		return `${heading}\n\nNo dependency changes to regenerate.`;
	}
	const lines = [heading, ``];
	const verb = data.dryRun ? "Would delete" : "Deleted";
	if (data.deleted.length > 0) {
		lines.push(`${verb} ${data.deleted.length} pure dependency changeset(s):`);
		for (const file of data.deleted) lines.push(`- ${mdInline(file)}`);
		lines.push(``);
	}
	if (data.written.length > 0) {
		lines.push(`${data.dryRun ? "Would write" : "Wrote"} ${data.written.length} fresh dependency changeset(s):`);
		for (const file of data.written) lines.push(`- ${mdInline(file)}`);
		lines.push(``);
	}
	if (data.skippedMixed.length > 0) {
		lines.push(`Skipped ${data.skippedMixed.length} mixed changeset(s):`);
		for (const file of data.skippedMixed) lines.push(`- ${mdInline(file)}`);
	}
	return lines.join("\n").trimEnd();
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ChangesetDepsRegenAsMarkdown = Schema.transformOrFail(ChangesetDepsRegenResult, Schema.String, {
	strict: true,
	decode: (data) => ParseResult.succeed(renderMarkdown(data)),
	encode: (text, _options, ast) =>
		ParseResult.fail(
			new ParseResult.Forbidden(ast, text, "ChangesetDepsRegenAsMarkdown is one-way: markdown cannot be parsed back."),
		),
});

/** Arguments for the {@link changesetDepsRegen} handler. */
export interface ChangesetDepsRegenArgs {
	readonly cwd?: string;
	readonly base?: string;
	readonly package?: string;
	readonly packages?: readonly string[];
	readonly exclude?: readonly string[];
	readonly dryRun?: boolean;
}

/**
 * Effect handler: resolve the workspace root, compute a {@link Changesets.RegenPlan}
 * via {@link Changesets.DepsRegen.plan}, then — unless `dryRun` — apply it via
 * `execute`. On a dry run the reported `deleted`/`written` reflect the plan's
 * intended files without touching the filesystem.
 */
export const changesetDepsRegen = (
	args: ChangesetDepsRegenArgs,
	fallbackCwd: string,
): Effect.Effect<
	ChangesetDepsRegenResultType,
	| Changesets.GitError
	| WorkspaceRootNotFoundError
	| WorkspaceDiscoveryError
	| Changesets.ChangesetIOError
	| PointInTimeReadError,
	WorkspaceRoot | Changesets.DepsRegen
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		const service = yield* Changesets.DepsRegen;
		const plan = yield* service.plan({
			cwd: root,
			...(args.base ? { base: args.base } : {}),
			...(args.package ? { package: args.package } : {}),
			...(args.packages && args.packages.length > 0 ? { packages: args.packages } : {}),
			...(args.exclude && args.exclude.length > 0 ? { exclude: args.exclude } : {}),
		});

		if (args.dryRun === true) {
			return {
				root,
				deleted: plan.toDelete.map((entry) => entry.file),
				written: plan.toWrite.map((entry) => entry.file),
				skippedMixed: [...plan.skippedMixed],
				dryRun: true,
			} as ChangesetDepsRegenResultType;
		}

		const result = yield* service.execute(plan);
		return {
			root,
			deleted: [...result.deleted],
			written: [...result.written],
			skippedMixed: [...result.skippedMixed],
			dryRun: false,
		} as ChangesetDepsRegenResultType;
	});

/**
 * The `changeset_preview` MCP tool: a read-only preview of the next release's
 * CHANGELOG, produced by the genuine changesets engine via silk-effects'
 * ReleasePlanner. Structured result + one-way markdown transform. Read-only.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Schema, SchemaGetter } from "effect";

/** The `changeset_preview` result — the silk-effects preview shape. */
export const ChangesetPreviewResult = Changesets.ChangesetPreviewSchema.annotate({
	identifier: "ChangesetPreviewResult",
	title: "changeset_preview result",
	description: "Read-only preview of the next release: version bumps + rendered CHANGELOG blocks.",
});

export type ChangesetPreviewResultType = Schema.Schema.Type<typeof ChangesetPreviewResult>;

/** Render a value as an inert markdown code span (escapes backticks/backslashes). */
const mdInline = (value: string): string => `\`${value.replace(/[`\\]/g, "\\$&")}\``;

/** Render the structured preview as a markdown transcript. */
const renderMarkdown = (data: ChangesetPreviewResultType): string => {
	if (data.releases.length === 0) {
		return "# changeset preview\n\nNo pending changesets.";
	}
	const lines = [`# changeset preview${data.preMode ? ` (pre: ${data.preMode})` : ""}`, ``, `## Version bumps`, ``];
	lines.push(`| Package | Old | New | Bump |`, `| --- | --- | --- | --- |`);
	for (const r of data.releases) {
		lines.push(`| ${mdInline(r.name)} | ${r.oldVersion} | ${r.newVersion} | ${r.type} |`);
	}
	lines.push(``, `## Release notes`, ``);
	for (const r of data.releases) {
		lines.push(`### ${mdInline(r.name)}`, ``, r.changelogEntry, ``);
	}
	return lines.join("\n").trimEnd();
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ChangesetPreviewAsMarkdown = ChangesetPreviewResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "ChangesetPreviewAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

/** Arguments for the {@link changesetPreview} handler. */
export interface ChangesetPreviewArgs {
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root, then render the preview via
 * ReleasePlanner. Mirrors `changesetInspect`.
 */
export const changesetPreview = (
	args: ChangesetPreviewArgs,
	fallbackCwd: string,
): Effect.Effect<
	ChangesetPreviewResultType,
	Changesets.ReleasePlanError | WorkspaceRootNotFoundError,
	Changesets.ReleasePlanner | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		const planner = yield* Changesets.ReleasePlanner;
		return yield* planner.preview(root);
	});

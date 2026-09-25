/**
 * The `changeset_preview` MCP tool: a read-only preview of the next release's
 * CHANGELOG, produced by the genuine changesets engine via silk-effects'
 * ReleasePlanner. Returns a structured result. Read-only.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, mapEngineError } from "../errors.js";

/** The `changeset_preview` result — the silk-effects preview shape. */
export const ChangesetPreviewResult = Changesets.ChangesetPreviewSchema.annotate({
	identifier: "ChangesetPreviewResult",
	title: "changeset_preview result",
	description: "Read-only preview of the next release: version bumps + rendered CHANGELOG blocks.",
});

export type ChangesetPreviewResultType = Schema.Schema.Type<typeof ChangesetPreviewResult>;

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

/** Wire parameters for `changeset_preview`. */
export const ChangesetPreviewParams = Schema.Struct({
	cwd: Schema.optionalKey(Schema.String.annotate({ description: "Directory to resolve the workspace root from." })),
});
export type ChangesetPreviewParams = typeof ChangesetPreviewParams.Type;

const REMEDIATION = {
	hint: "The changesets engine could not render the release; validate the pending changesets first.",
	suggestedTool: "changeset_validate",
};

/** The `changeset_preview` tool value. */
export const changesetPreviewTool = Tool.make("changeset_preview", {
	description:
		"Read-only preview of the next release. Runs the genuine changesets engine over the pending changesets and returns each package's version bump (old -> new) plus the rendered CHANGELOG block (dependency tables included), exactly as it would ship. Does not modify the repo. Prefer this over hand-merging changeset files. Returns a typed object in structuredContent (content[] carries the same object as JSON).",
	parameters: ChangesetPreviewParams,
	success: ChangesetPreviewResult,
	failure: McpToolError,
	dependencies: [Changesets.ReleasePlanner, WorkspaceRoot],
})
	.annotate(Tool.Title, "Preview the next release")
	.annotate(Tool.Readonly, true)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, true)
	.annotate(Tool.OpenWorld, false);

/** Wire handler: {@link changesetPreview} with its error channel mapped onto {@link McpToolError}. */
export const handleChangesetPreview = (fallbackCwd: string, params: ChangesetPreviewParams) =>
	changesetPreview(params, fallbackCwd).pipe(Effect.mapError(mapEngineError(params.cwd ?? fallbackCwd, REMEDIATION)));

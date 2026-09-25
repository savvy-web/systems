/**
 * The `changeset_validate` MCP tool: structured changeset-file validation over
 * silk-effects' pure ChangesetLinter, returning typed diagnostics plus a
 * pass/fail summary. Read-only.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";
import { ToolFailure } from "@effected/mcp";
import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Data, Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, invalidArgument, mapEngineError } from "../errors.js";

/** A thrown failure from the pure {@link Changesets.ChangesetLinter.validate} (e.g. a missing directory). */
export class ChangesetValidateError extends Data.TaggedError("ChangesetValidateError")<{
	readonly dir: string;
	readonly cause: unknown;
}> {}

/** A single changeset lint diagnostic. Mirrors silk-effects' `LintMessage`. */
export const ChangesetLintMessage = Schema.Struct({
	file: Schema.String,
	rule: Schema.String,
	line: Schema.Number,
	column: Schema.Number,
	message: Schema.String,
}).annotate({ identifier: "ChangesetLintMessage" });

/** The `changeset_validate` tool result. */
export const ChangesetValidateResult = Schema.Struct({
	dir: Schema.String,
	ok: Schema.Boolean,
	errorCount: Schema.Number,
	messages: Schema.Array(ChangesetLintMessage),
}).annotate({
	identifier: "ChangesetValidateResult",
	title: "changeset_validate result",
	description: "Read-only validation of changeset files against the section-aware rules.",
});

export type ChangesetValidateResultType = Schema.Schema.Type<typeof ChangesetValidateResult>;

/** Arguments for the {@link changesetValidate} handler. */
export interface ChangesetValidateArgs {
	readonly dir?: string;
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root, then validate the changeset
 * directory via the pure {@link Changesets.ChangesetLinter.validate}. The
 * synchronous call is wrapped in {@link Effect.try} so a thrown error (e.g. a
 * missing directory) surfaces as a typed {@link ChangesetValidateError} rather
 * than escaping as a defect.
 */
export const changesetValidate = (
	args: ChangesetValidateArgs,
	fallbackCwd: string,
): Effect.Effect<ChangesetValidateResultType, WorkspaceRootNotFoundError | ChangesetValidateError, WorkspaceRoot> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		const dir = resolve(root, args.dir ?? ".changeset");
		const messages = yield* Effect.try({
			try: () => Changesets.ChangesetLinter.validate(dir),
			catch: (cause) => new ChangesetValidateError({ dir, cause }),
		});
		return {
			dir,
			ok: messages.length === 0,
			errorCount: messages.length,
			messages,
		} as ChangesetValidateResultType;
	});

/** Wire parameters for `changeset_validate`. */
export const ChangesetValidateParams = Schema.Struct({
	dir: Schema.optionalKey(
		Schema.String.annotate({ description: "Changeset directory to validate (default .changeset)." }),
	),
	cwd: Schema.optionalKey(Schema.String.annotate({ description: "Directory to resolve the workspace root from." })),
});
export type ChangesetValidateParams = typeof ChangesetValidateParams.Type;

const DIR_REMEDIATION = {
	hint: "Pass dir as a path (relative to the workspace root) to an existing changeset directory, or omit it for .changeset.",
};

/** The `changeset_validate` tool value. */
export const changesetValidateTool = Tool.make("changeset_validate", {
	description:
		"Read-only validation of changeset files against the section-aware rules. Pass dir (default .changeset). Returns typed diagnostics (file, rule, line, column, message) plus ok/errorCount in structuredContent. Prefer this over shelling out to savvy changeset lint. Returns a typed object in structuredContent (content[] carries the same object as JSON).",
	parameters: ChangesetValidateParams,
	success: ChangesetValidateResult,
	failure: McpToolError,
	dependencies: [WorkspaceRoot],
})
	.annotate(Tool.Title, "Validate changesets")
	.annotate(Tool.Readonly, true)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, true)
	.annotate(Tool.OpenWorld, false);

/**
 * Wire handler: {@link changesetValidate} with its error channel mapped onto
 * {@link McpToolError}. The typed {@link ChangesetValidateError} (a thrown
 * validate — in practice a missing directory) is an argument problem, so it
 * becomes {@link InvalidArgument} naming `dir`; the echoed directory is
 * truncated.
 */
export const handleChangesetValidate = (fallbackCwd: string, params: ChangesetValidateParams) =>
	changesetValidate(params, fallbackCwd).pipe(
		Effect.mapError((error) =>
			error._tag === "ChangesetValidateError"
				? invalidArgument(
						"dir",
						`Changeset directory "${ToolFailure.truncate(error.dir)}" could not be validated: ${describeCause(error.cause)}`,
						DIR_REMEDIATION,
					)
				: mapEngineError(params.cwd ?? fallbackCwd, DIR_REMEDIATION)(error),
		),
	);

const describeCause = (cause: unknown): string =>
	cause instanceof Error ? ToolFailure.truncate(cause.message) : ToolFailure.truncate(String(cause));

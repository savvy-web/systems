/**
 * The one typed failure union every savvy-mcp tool declares, plus the
 * constructors that keep each member's `message` self-contained on the wire.
 *
 * @remarks
 * Under `failureMode: "error"` (the only mode these tools use) a declared
 * typed failure reaches the client as
 * `{ isError: true, content: [{ type: "text", text: error.message }] }` and
 * `structuredContent` is never populated for it
 * (`declaredFailureResult` in
 * `.repos/effect/packages/effect/src/unstable/ai/McpServer.ts` — see the
 * header of `server.ts`). So a structured `remediation` field is invisible to
 * a real client: every member spreads `@effected/mcp`'s `ToolFailure.fields`,
 * folds its hint into `message` at construction through
 * `ToolFailure.message`, and passes any caller-supplied value it echoes
 * through `ToolFailure.truncate`.
 *
 * A refusal with nothing to carry beyond its message — a bad argument, a
 * missing Biome binary — is the kit's own `ToolRefusal`, built with
 * `ToolRefusal.refuse(reason, remediation)`. The typed members below stay
 * for the failures that carry a field of their own (`cwd`, `source`,
 * `exitCode`).
 *
 * @packageDocumentation
 */

import type { Remediation } from "@effected/engine";
import { ToolFailure, ToolRefusal } from "@effected/mcp";
import { Schema } from "effect";

/**
 * No workspace root was found walking up from the requested directory.
 * `message` is composed through `ToolFailure.message` at construction, so it
 * is what reaches the wire as `content[0].text`.
 *
 * @public
 */
export class WorkspaceNotFound extends Schema.TaggedError<WorkspaceNotFound>()("WorkspaceNotFound", {
	...ToolFailure.fields,
	cwd: Schema.String,
}) {}

/**
 * A silk-effects engine program failed with one of its own typed errors
 * (`TurboError`, `GitError`, `ReposConfigError`, …). `source` carries that
 * error's `_tag`; `message` is its own rendering plus the remediation,
 * composed through `ToolFailure.message`.
 *
 * @public
 */
export class EngineError extends Schema.TaggedError<EngineError>()("EngineError", {
	...ToolFailure.fields,
	source: Schema.String,
}) {}

/**
 * Biome itself failed (exit status above 1, a spawn error, or a timeout) —
 * distinct from "lint issues found", which is a successful result. `message`
 * is composed through `ToolFailure.message`.
 *
 * @public
 */
export class BiomeFailed extends Schema.TaggedError<BiomeFailed>()("BiomeFailed", {
	...ToolFailure.fields,
	exitCode: Schema.optionalKey(Schema.Number),
}) {}

/** The one failure schema every savvy-mcp tool declares. @public */
export const McpToolError = Schema.Union([WorkspaceNotFound, EngineError, BiomeFailed, ToolRefusal]);
/** @public */
export type McpToolError = typeof McpToolError.Type;

/** The remediation every `WorkspaceNotFound` carries. */
const WORKSPACE_REMEDIATION: Remediation = {
	hint: "Pass a cwd inside the project (a directory at or below a package.json with a workspace manifest), or omit cwd to use the server's project directory.",
	suggestedTool: "workspace_info",
};

/**
 * Build a {@link WorkspaceNotFound} for the directory the caller asked about.
 * The kit's own `WorkspaceRootNotFoundError` message renders the search path
 * and probed markers; it is not echoed because it embeds the untruncated
 * caller value, which `cwd` already carries through `ToolFailure.truncate`.
 *
 * @public
 */
export const workspaceNotFound = (cwd: string): WorkspaceNotFound =>
	new WorkspaceNotFound({
		cwd,
		message: ToolFailure.message(
			`No workspace root was found walking up from "${ToolFailure.truncate(cwd)}".`,
			WORKSPACE_REMEDIATION,
		),
		remediation: WORKSPACE_REMEDIATION,
	});

/**
 * Build an {@link EngineError} from a silk-effects typed error. Every engine
 * error in this server renders itself through a `message` getter, so that
 * rendering is the raw message — passed through `ToolFailure.truncate` at
 * `ToolFailure.ENGINE_ECHO_LIMIT`, since the kit embeds caller values in it;
 * `source` keeps the tag for anything that inspects the typed error directly.
 *
 * @public
 */
export const engineError = (
	cause: { readonly _tag: string; readonly message: string },
	remediation: Remediation,
): EngineError =>
	new EngineError({
		source: cause._tag,
		message: ToolFailure.message(ToolFailure.truncate(cause.message, ToolFailure.ENGINE_ECHO_LIMIT), remediation),
		remediation,
	});

/**
 * The shared mapping every handler applies to its engine error channel: the
 * kit's `WorkspaceRootNotFoundError` becomes {@link WorkspaceNotFound} for the
 * directory the caller requested; anything else becomes {@link EngineError}
 * with the tool's remediation.
 *
 * @param requestedCwd - the directory the caller asked about (already the
 *   fallback when the call omitted `cwd`)
 * @param remediation - the tool-specific hint for an engine failure
 *
 * @public
 */
export const mapEngineError =
	(requestedCwd: string, remediation: Remediation) =>
	(cause: { readonly _tag: string; readonly message: string }): WorkspaceNotFound | EngineError =>
		cause._tag === "WorkspaceRootNotFoundError" ? workspaceNotFound(requestedCwd) : engineError(cause, remediation);

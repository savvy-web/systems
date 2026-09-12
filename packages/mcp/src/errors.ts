/**
 * The one typed failure union every savvy-mcp tool declares, plus the helpers
 * that keep each member's `message` self-contained on the wire.
 *
 * @remarks
 * Under `failureMode: "error"` (the only mode these tools use) a declared
 * typed failure reaches the client as
 * `{ isError: true, content: [{ type: "text", text: error.message }] }` and
 * `structuredContent` is never populated for it
 * (`.repos/effect/packages/effect/src/unstable/ai/McpServer.ts:1513-1517,1592-1607`
 * at rc.115 — see the header of `server.ts`). So a structured `remediation`
 * field is invisible to a real client: every member folds its hint into
 * `message` at construction through {@link composeRemediatedMessage}, and any
 * caller-supplied value echoed back passes through {@link truncateEchoed}.
 *
 * @packageDocumentation
 */

import { Schema } from "effect";

/** What a caller should do next about a failed tool call. @public */
export const Remediation = Schema.Struct({
	hint: Schema.String,
	suggestedTool: Schema.optionalKey(Schema.String),
});
/** @public */
export type Remediation = typeof Remediation.Type;

/**
 * Compose a self-contained wire message from a raw cause message and its
 * remediation: the human message, then the hint, then `Try <suggestedTool>.`
 * when one is present. Every {@link McpToolError} member's `message` is built
 * through this at construction, because `message` is the only field a
 * declared failure delivers to the wire.
 *
 * @public
 */
export const composeRemediatedMessage = (message: string, remediation: Remediation): string =>
	remediation.suggestedTool === undefined
		? `${message} ${remediation.hint}`
		: `${message} ${remediation.hint} Try ${remediation.suggestedTool}.`;

const ECHO_LIMIT = 200;

/**
 * The limit for an ENGINE message echoed through {@link engineError} or an
 * argument-decode message: wider than {@link truncateEchoed}'s default because
 * the engine's own rendering (a git stderr, a decode path) is the diagnostic,
 * but still bounded — the kit embeds caller values (`base`, `task`, the
 * decoded value) in those messages untruncated.
 */
export const ENGINE_ECHO_LIMIT = 2000;

/**
 * Truncate a caller-supplied value before it is echoed back inside an error's
 * `message`. Without this a pathological argument (a multi-megabyte `cwd`,
 * say) is echoed once in the response's `content[0].text` and once more in the
 * corresponding log line, burning an agent's context twice on what is usually
 * a typo.
 *
 * @public
 */
export const truncateEchoed = (value: string, limit: number = ECHO_LIMIT): string =>
	value.length > limit ? `${value.slice(0, limit)}…` : value;

/**
 * No workspace root was found walking up from the requested directory.
 * `message` is composed through {@link composeRemediatedMessage} at
 * construction, so it is what reaches the wire as `content[0].text`.
 *
 * @public
 */
export class WorkspaceNotFound extends Schema.TaggedError<WorkspaceNotFound>()("WorkspaceNotFound", {
	cwd: Schema.String,
	message: Schema.String,
	remediation: Remediation,
}) {}

/**
 * A tool argument was structurally acceptable but semantically invalid — a
 * `repos_manage` action missing the field it needs, a `biome_check` path
 * outside the workspace, a `changeset_validate` directory that does not
 * exist. `message` is composed through {@link composeRemediatedMessage}.
 *
 * @public
 */
export class InvalidArgument extends Schema.TaggedError<InvalidArgument>()("InvalidArgument", {
	argument: Schema.String,
	message: Schema.String,
	remediation: Remediation,
}) {}

/**
 * A silk-effects engine program failed with one of its own typed errors
 * (`TurboError`, `GitError`, `ReposConfigError`, …). `source` carries that
 * error's `_tag`; `message` is its own rendering plus the remediation,
 * composed through {@link composeRemediatedMessage}.
 *
 * @public
 */
export class EngineError extends Schema.TaggedError<EngineError>()("EngineError", {
	source: Schema.String,
	message: Schema.String,
	remediation: Remediation,
}) {}

/**
 * No Biome binary could be located. `message` is composed through
 * {@link composeRemediatedMessage}.
 *
 * @public
 */
export class BiomeUnavailable extends Schema.TaggedError<BiomeUnavailable>()("BiomeUnavailable", {
	message: Schema.String,
	remediation: Remediation,
}) {}

/**
 * Biome itself failed (exit status above 1, a spawn error, or a timeout) —
 * distinct from "lint issues found", which is a successful result. `message`
 * is composed through {@link composeRemediatedMessage}.
 *
 * @public
 */
export class BiomeFailed extends Schema.TaggedError<BiomeFailed>()("BiomeFailed", {
	exitCode: Schema.optionalKey(Schema.Number),
	message: Schema.String,
	remediation: Remediation,
}) {}

/** The one failure schema every savvy-mcp tool declares. @public */
export const McpToolError = Schema.Union([
	WorkspaceNotFound,
	InvalidArgument,
	EngineError,
	BiomeUnavailable,
	BiomeFailed,
]);
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
 * caller value, which `cwd` already carries through {@link truncateEchoed}.
 *
 * @public
 */
export const workspaceNotFound = (cwd: string): WorkspaceNotFound =>
	new WorkspaceNotFound({
		cwd,
		message: composeRemediatedMessage(
			`No workspace root was found walking up from "${truncateEchoed(cwd)}".`,
			WORKSPACE_REMEDIATION,
		),
		remediation: WORKSPACE_REMEDIATION,
	});

/**
 * Build an {@link InvalidArgument}: `raw` is the human message (already
 * truncated by the caller where it echoes an argument).
 *
 * @public
 */
export const invalidArgument = (argument: string, raw: string, remediation: Remediation): InvalidArgument =>
	new InvalidArgument({ argument, message: composeRemediatedMessage(raw, remediation), remediation });

/**
 * Build an {@link EngineError} from a silk-effects typed error. Every engine
 * error in this server renders itself through a `message` getter, so that
 * rendering is the raw message — passed through {@link truncateEchoed} at
 * {@link ENGINE_ECHO_LIMIT}, since the kit embeds caller values in it;
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
		message: composeRemediatedMessage(truncateEchoed(cause.message, ENGINE_ECHO_LIMIT), remediation),
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

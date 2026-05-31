/**
 * Schemas for the JSON stdin envelopes Claude passes to plugin hooks.
 *
 * @remarks
 * These are intentionally permissive — `Schema.Unknown` is used for fields
 * we don't inspect (the agent may add unknown keys; we don't want a forward-
 * compatibility break to make the hook fail).
 *
 * @internal
 */
import { Schema } from "effect";

export const PreToolUseEnvelope = Schema.Struct({
	hook_event_name: Schema.Literal("PreToolUse"),
	tool_name: Schema.String,
	tool_input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});
export type PreToolUseEnvelope = Schema.Schema.Type<typeof PreToolUseEnvelope>;

export const PostToolUseEnvelope = Schema.Struct({
	hook_event_name: Schema.Literal("PostToolUse"),
	tool_name: Schema.String,
	tool_input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
	tool_response: Schema.Struct({
		interrupted: Schema.optional(Schema.Boolean),
		exit_code: Schema.optional(Schema.Number),
		stdout: Schema.optional(Schema.String),
		stderr: Schema.optional(Schema.String),
	}),
});
export type PostToolUseEnvelope = Schema.Schema.Type<typeof PostToolUseEnvelope>;

export const UserPromptSubmitEnvelope = Schema.Struct({
	hook_event_name: Schema.Literal("UserPromptSubmit"),
	prompt: Schema.String,
});
export type UserPromptSubmitEnvelope = Schema.Schema.Type<typeof UserPromptSubmitEnvelope>;

export const SessionStartEnvelope = Schema.Struct({
	hook_event_name: Schema.Literal("SessionStart"),
	source: Schema.optional(Schema.String),
});
export type SessionStartEnvelope = Schema.Schema.Type<typeof SessionStartEnvelope>;

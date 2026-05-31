# shellcheck shell=bash
# hook-output.sh — shared helpers for emitting Claude Code hook responses.
#
# Source this from any hook script:
#   . "$(dirname "$0")/../lib/hook-output.sh"
#
# Provides functions that print the documented JSON response shapes to stdout
# without ad-hoc string concatenation. Each function exits with 0 — the host
# treats the JSON as the decision signal.

# Preflight: jq is required for every emitter except emit_noop. Warn loudly
# rather than letting hooks silently produce empty stdout when jq is missing.
if ! command -v jq >/dev/null 2>&1; then
	echo "hook-output.sh: jq not found on PATH. Only emit_noop will work; other emitters will fail loudly." >&2
fi

# emit_noop — print an empty no-op response. Use when the hook decided not
# to act and the tool / event should proceed unchanged. Equivalent to
# returning an empty JSON object, but explicit and grep-friendly.
emit_noop() {
	printf '{}\n'
}

# emit_allow — PreToolUse-specific. Approves the tool call without showing
# the permission prompt. Optionally rewrites tool_input.
#
# Usage:
#   emit_allow                                     # approve without rewrite
#   emit_allow "$new_tool_input_json"              # approve with rewrite
#
# If $1 is provided but isn't valid JSON, falls back to allow-without-rewrite
# and logs a warning, rather than silently producing no output.
emit_allow() {
	local updated_input="${1:-}"
	if [ -n "$updated_input" ]; then
		if ! printf '%s' "$updated_input" | jq -e . >/dev/null 2>&1; then
			echo "emit_allow: updated_input is not valid JSON; falling back to plain allow" >&2
			emit_allow
			return $?
		fi
		jq -n \
			--argjson ui "$updated_input" \
			'{
				hookSpecificOutput: {
					hookEventName: "PreToolUse",
					permissionDecision: "allow",
					updatedInput: $ui
				}
			}'
	else
		jq -n '{
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "allow"
			}
		}'
	fi
}

# emit_deny — PreToolUse-specific. Prevents the tool call. `reason` is shown
# to Claude (not the user).
#
# Usage:
#   emit_deny "<reason for Claude>"
emit_deny() {
	local reason="${1:-Plugin policy denied this tool call.}"
	jq -n --arg r "$reason" '{
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: "deny",
			permissionDecisionReason: $r
		}
	}'
}

# emit_context — UserPromptSubmit / SessionStart / PostToolUse / etc.:
# adds `additionalContext` to Claude's next call without changing any
# decision. `event_name` must match the firing event.
#
# Usage:
#   emit_context "PostToolUse" "test_failed_run recorded as artifact 42"
emit_context() {
	local event_name="${1:?emit_context: event_name required as first arg}"
	local ctx="${2:-}"
	jq -n \
		--arg evt "$event_name" \
		--arg ctx "$ctx" \
		'{
			hookSpecificOutput: {
				hookEventName: $evt,
				additionalContext: $ctx
			}
		}'
}

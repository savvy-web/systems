# hook-output.sh — shared helpers for emitting Claude Code hook responses.
#
# Source from a hook script:
#   . "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
#
# Each emitter prints the documented JSON response shape to stdout. Hooks
# always exit 0 after emitting; the JSON is the decision signal.

# emit_noop — print an empty no-op response. Use when the hook decided not
# to act and the tool / event should proceed unchanged.
emit_noop() {
	printf '{}\n'
}

# emit_allow — PreToolUse-specific. Approves the tool call.
#   emit_allow                          # plain allow
#   emit_allow "<reason for Claude>"    # allow with reason
emit_allow() {
	local reason="${1:-}"
	if [ -n "$reason" ]; then
		jq -n --arg r "$reason" '{
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "allow",
				permissionDecisionReason: $r
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

# emit_deny — PreToolUse-specific. Prevents the tool call. The reason is
# shown to Claude (not the user).
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

# emit_context — additionalContext for UserPromptSubmit / SessionStart /
# PostToolUse / etc. The event_name argument must match the firing event.
emit_context() {
	local event_name="${1:?emit_context: event_name required}"
	local ctx="${2:-}"
	jq -n --arg evt "$event_name" --arg ctx "$ctx" '{
		hookSpecificOutput: {
			hookEventName: $evt,
			additionalContext: $ctx
		}
	}'
}

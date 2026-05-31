# shellcheck shell=bash
# Minimal hook-output helper for the github-actions plugin skeleton.

emit_noop() {
	printf '{}\n'
}

# emit_context <event_name> <context_string>
emit_context() {
	local event_name="${1:?emit_context: event_name required}"
	local ctx="${2:-}"
	if command -v jq >/dev/null 2>&1; then
		jq -n --arg evt "$event_name" --arg ctx "$ctx" \
			'{ hookSpecificOutput: { hookEventName: $evt, additionalContext: $ctx } }'
	else
		emit_noop
	fi
}

# hook-debug.sh — shared logging helpers for the github-actions plugin hooks.
#
# Source from a hook script:
#   . "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
#
# hook_error <hook-name> <message>  — always logs; for failures the
#                                     maintainer needs to see.
# hook_debug <hook-name> <message>  — only logs when GITHUB_ACTIONS_HOOK_DEBUG=1.
#
# Log paths default to
#   $XDG_STATE_HOME/${HOOK_LOG_PREFIX}/hook-errors.log
#   $XDG_STATE_HOME/${HOOK_LOG_PREFIX}/hook-debug.log
# and can be overridden with GITHUB_ACTIONS_HOOK_ERROR_LOG / GITHUB_ACTIONS_HOOK_DEBUG_LOG.

: "${HOOK_LOG_PREFIX:=github-actions}"

_log_dir() {
	echo "${XDG_STATE_HOME:-$HOME/.local/state}/${HOOK_LOG_PREFIX}"
}

_resolve_log_path() {
	local suffix="$1"  # hook-errors | hook-debug
	local override="${2:-}"
	if [ -n "$override" ]; then
		echo "$override"
		return
	fi
	local dir
	dir="$(_log_dir)"
	mkdir -p "$dir" 2>/dev/null || true
	echo "${dir}/${suffix}.log"
}

hook_error() {
	local hook_name="$1"; shift
	local msg="$*"
	local ts; ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
	local path; path=$(_resolve_log_path "hook-errors" "${GITHUB_ACTIONS_HOOK_ERROR_LOG:-}")
	printf '[%s] %s: %s\n' "$ts" "$hook_name" "$msg" >> "$path" 2>/dev/null || true
}

hook_debug() {
	[ "${GITHUB_ACTIONS_HOOK_DEBUG:-0}" = "1" ] || return 0
	local hook_name="$1"; shift
	local msg="$*"
	local ts; ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
	local path; path=$(_resolve_log_path "hook-debug" "${GITHUB_ACTIONS_HOOK_DEBUG_LOG:-}")
	printf '[%s] %s: %s\n' "$ts" "$hook_name" "$msg" >> "$path" 2>/dev/null || true
}

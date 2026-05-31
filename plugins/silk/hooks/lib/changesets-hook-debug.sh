# shellcheck shell=bash
# hook-debug.sh — shared logging helpers for Claude Code plugin hooks.
#
# Source this from any hook script:
#   . "$(dirname "$0")/../lib/hook-debug.sh"
#
# Provides two functions:
#   hook_error <hook-name> <message>  — always logs; for failures the
#                                       maintainer needs to see.
#   hook_debug <hook-name> <message>  — only logs when CHANGESETS_HOOK_DEBUG
#                                       (or PLUGIN_DEBUG env var) is set;
#                                       for tracing.
#
# The log paths are configurable via env so plugins can colocate logs
# without colliding with each other:
#   <PLUGIN>_HOOK_ERROR_LOG  — defaults to /tmp/<plugin>-hook-errors.log
#   <PLUGIN>_HOOK_DEBUG_LOG  — defaults to /tmp/<plugin>-hook-debug.log
#   <PLUGIN>_HOOK_DEBUG      — when set to 1, hook_debug actually logs
#
# Customize the variable prefix per plugin by editing the defaults below.

# Defaults — change PREFIX to match your plugin namespace.
# Default is intentionally unmemorable so authors notice and customize.
: "${HOOK_LOG_PREFIX:=changesets}"

# Bash 3.2-safe uppercase. macOS default /bin/bash is 3.2; `${var^^}` is
# Bash 4+ only and would fail at parse time on the system shell.
_to_upper() {
	printf '%s' "$1" | tr '[:lower:]' '[:upper:]'
}

_default_log_dir() {
	echo "${XDG_STATE_HOME:-$HOME/.local/state}/${HOOK_LOG_PREFIX}"
}

_resolve_log_path() {
	local suffix="$1"
	local override_var
	override_var="$(_to_upper "$HOOK_LOG_PREFIX")_$(_to_upper "$suffix")"
	local override_val="${!override_var:-}"
	if [ -n "$override_val" ]; then
		echo "$override_val"
		return
	fi
	local log_dir
	log_dir="$(_default_log_dir)"
	mkdir -p "$log_dir" 2>/dev/null || true
	echo "${log_dir}/${suffix//_/-}.log"
}

_is_debug_on() {
	local override_var
	override_var="$(_to_upper "$HOOK_LOG_PREFIX")_HOOK_DEBUG"
	[ "${!override_var:-0}" = "1" ]
}

# hook_error — always log. First arg is the hook name (for grep), rest is the message.
hook_error() {
	local hook_name="$1"
	shift
	local msg="$*"
	local ts
	ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
	local log_path
	log_path=$(_resolve_log_path "hook_error_log")
	# Append; never block the hook on a logging failure.
	printf '[%s] %s: %s\n' "$ts" "$hook_name" "$msg" >> "$log_path" 2>/dev/null || true
}

# hook_debug — only log when <PREFIX>_HOOK_DEBUG=1.
hook_debug() {
	if ! _is_debug_on; then
		return 0
	fi
	local hook_name="$1"
	shift
	local msg="$*"
	local ts
	ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
	local log_path
	log_path=$(_resolve_log_path "hook_debug_log")
	printf '[%s] %s: %s\n' "$ts" "$hook_name" "$msg" >> "$log_path" 2>/dev/null || true
}

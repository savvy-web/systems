# shellcheck shell=bash
# source-session-env.sh — lateral env propagation for plugin hooks.
#
# Background: Claude Code auto-sources $CLAUDE_ENV_FILE into Bash-tool
# subprocesses, but NOT into hook subprocesses. Producer events
# (SessionStart, Setup, CwdChanged, FileChanged) write env exports there;
# reader events (PreToolUse, PostToolUse, SubagentStart, ...) do not see
# them.
#
# Workaround: producer hooks write the same exports into a per-session
# file under ~/.claude/session-env/${session_id}/<plugin>-hook.sh.
# Reader hooks call this helper at entry to pick them up.
#
# Usage in any reader hook (source the file first to define the function,
# then invoke the function explicitly — the file does NOT auto-invoke):
#
#   . "$(dirname "$0")/../lib/source-session-env.sh"
#   source_session_env "$session_id"
#
# The function sources every *hook*.sh file in the per-session dir so
# multiple plugins coexist without filename coordination — each plugin
# names its file <plugin>-hook.sh.

source_session_env() {
	local session_id="${1:-}"
	if [ -z "$session_id" ]; then
		return 0
	fi

	# Validate the session id shape. The session_id comes from the host
	# hook envelope (untrusted JSON); reject anything that could escape
	# the env dir or shell-glob unexpectedly.
	case "$session_id" in
		*/*|*..*|''|.|..|*[$'\n\r\t']*) return 0 ;;
	esac

	local env_dir="${HOME}/.claude/session-env/${session_id}"
	if [ ! -d "$env_dir" ]; then
		return 0
	fi

	local f
	# Relax errexit while sourcing per-session files. A malformed file
	# from another plugin would otherwise abort the calling hook midway.
	# Vars exported by valid files still reach the caller's shell because
	# the function shares its scope.
	local _errexit_was_on=0
	case $- in *e*) _errexit_was_on=1; set +e ;; esac
	for f in "$env_dir"/*hook*.sh; do
		if [ -f "$f" ]; then
			# shellcheck source=/dev/null
			. "$f"
		fi
	done
	if [ "$_errexit_was_on" = "1" ]; then set -e; fi
}

# Do NOT auto-invoke from the sourcing script's positional args. The
# previous version of this file ran `source_session_env "$1"` at file
# scope, which picked up the *caller's* $1 — false-firing whenever a
# hook script invoked with positional args sourced this file. Callers
# must invoke the function explicitly:
#     . "$(dirname "$0")/../lib/source-session-env.sh"
#     source_session_env "$session_id"
#     source_session_env "$session_id"

#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: auto-allow Read|Write|Edit against the plugin's own cache
# under <project>/.claude/cache/. Everything else is left alone.
#
# Fails open: no jq or a malformed envelope emits a no-op and lets the tool call
# proceed to normal permissioning.

# shellcheck source=../lib/pluginfinity/hook.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
# shellcheck source=../lib/silk/hook-env.sh
. "$(dirname "$0")/../lib/silk/hook-env.sh"

hook_require_input

PATH_ARG=$(hook_input tool_input.file_path)
[ -z "$PATH_ARG" ] && exit 0

# The tree the call runs in (input cwd walked up to its .git, worktree-correct
# per savvy-web/systems#274), never CLAUDE_PROJECT_DIR first.
PROJECT_DIR=$(hook_project_dir)

case "$PATH_ARG" in
  /*) ABS="$PATH_ARG" ;;
  *)  ABS="${PROJECT_DIR}/${PATH_ARG}" ;;
esac

case "$ABS" in
  "${PROJECT_DIR}/.claude/cache/"*)
    # Defer the tool_name read into the branch that actually uses it.
    TOOL=$(hook_input tool_name)
    hook_allow "auto-allowed plugin cache path: $TOOL"
    ;;
esac
exit 0

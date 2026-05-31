#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

if ! command -v jq >/dev/null 2>&1; then
  hook_error "pre-tool-use/fs" "jq not found; skipping"
  emit_noop
  exit 0
fi

ENVELOPE=$(cat)
PATH_ARG=$(echo "$ENVELOPE" | jq -r '.tool_input.file_path // empty')
[ -z "$PATH_ARG" ] && exit 0

case "$PATH_ARG" in
  /*) ABS="$PATH_ARG" ;;
  *)  ABS="${CLAUDE_PROJECT_DIR}/${PATH_ARG}" ;;
esac

case "$ABS" in
  "${CLAUDE_PROJECT_DIR}/.claude/cache/"*)
    # Defer the tool_name read into the branch that actually uses it.
    TOOL=$(echo "$ENVELOPE" | jq -r '.tool_name // empty')
    emit_allow "auto-allowed plugin cache path: $TOOL"
    ;;
esac
exit 0

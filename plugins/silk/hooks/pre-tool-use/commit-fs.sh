#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: auto-allow Read|Write|Edit against the plugin's own cache
# under <project>/.claude/cache/. Everything else is left alone.
#
# Fails open: no jq, a malformed envelope, or no resolvable project dir all emit
# a no-op and let the tool call proceed to normal permissioning.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/fs"

if ! command -v jq >/dev/null 2>&1; then
  hook_error "$_HOOK" "jq not found; skipping"
  emit_noop
  exit 0
fi

read_envelope_or_noop "$_HOOK"

PATH_ARG=$(jq -r '.tool_input.file_path // empty' <<< "$HOOK_ENVELOPE")
[ -z "$PATH_ARG" ] && exit 0

# Resolve the project dir rather than dereferencing CLAUDE_PROJECT_DIR directly:
# under `set -u` an unset variable aborted the hook with an unbound-variable
# error instead of failing open, which is the posture every other hook takes.
# With nothing to resolve we cannot say what is "inside the cache", so say
# nothing — guessing with pwd could auto-allow a write under an unrelated root.
PROJECT_DIR=$(resolve_project_dir "$HOOK_ENVELOPE")
if [ -z "$PROJECT_DIR" ]; then
  hook_error "$_HOOK" "no project dir (envelope cwd / SILK_PROJECT_DIR / CLAUDE_PROJECT_DIR all unset); skipping"
  emit_noop
  exit 0
fi

case "$PATH_ARG" in
  /*) ABS="$PATH_ARG" ;;
  *)  ABS="${PROJECT_DIR}/${PATH_ARG}" ;;
esac

case "$ABS" in
  "${PROJECT_DIR}/.claude/cache/"*)
    # Defer the tool_name read into the branch that actually uses it.
    TOOL=$(jq -r '.tool_name // empty' <<< "$HOOK_ENVELOPE")
    emit_allow "auto-allowed plugin cache path: $TOOL"
    ;;
esac
exit 0

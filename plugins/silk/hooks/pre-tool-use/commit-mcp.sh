#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

if ! command -v jq >/dev/null 2>&1; then
  hook_error "pre-tool-use/mcp" "jq not found; skipping"
  emit_noop
  exit 0
fi

ENVELOPE=$(cat)
TOOL=$(echo "$ENVELOPE" | jq -r '.tool_name // empty')
[ -z "$TOOL" ] && exit 0

# Split mcp__<server>__<op>, supporting scoped server names like
# mcp__github-acme__list_issues. Scope segments may contain any non-`__`
# character, so use shell parameter expansion (^___ greedy strip after a
# scope-aware prefix) instead of a brittle char-class regex.
case "$TOOL" in
  mcp__gk__*)
    OP="${TOOL#mcp__gk__}"
    SERVER="gk"
    ;;
  mcp__github__*)
    OP="${TOOL#mcp__github__}"
    SERVER="github"
    ;;
  mcp__github-*__*)
    REST="${TOOL#mcp__github-}"
    OP="${REST#*__}"
    SERVER="github"
    ;;
  *)
    exit 0
    ;;
esac

ALLOW="${CLAUDE_PLUGIN_ROOT}/hooks/lib/safe-mcp-${SERVER}-ops.txt"
if [ ! -f "$ALLOW" ]; then exit 0; fi

# Strip comments / blanks and match the op against the allow-list as a
# whole-line fixed string.
if grep -vE '^[[:space:]]*(#|$)' "$ALLOW" | grep -Fxq "$OP"; then
  emit_allow "auto-allowed MCP tool: $TOOL"
fi
exit 0

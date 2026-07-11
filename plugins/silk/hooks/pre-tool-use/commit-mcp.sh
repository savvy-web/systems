#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/mcp"

if ! command -v jq >/dev/null 2>&1; then
  hook_error "$_HOOK" "jq not found; skipping"
  emit_noop
  exit 0
fi

read_envelope_or_noop "$_HOOK"
TOOL=$(jq -r '.tool_name // empty' <<< "$HOOK_ENVELOPE")
[ -z "$TOOL" ] && exit 0

# Split mcp__<server>__<op>, supporting scoped server names like
# mcp__github-acme__list_issues. Scope segments may contain any non-`__`
# character, so use shell parameter expansion (^___ greedy strip after a
# scope-aware prefix) instead of a brittle char-class regex.
# The GitKraken MCP server registers as `gitkraken` (or `GitKraken` in some
# clients); `gk` is kept for back-compat with older configs. All three feed
# the same safe-mcp-gk-ops.txt allow-list.
case "$TOOL" in
  mcp__gk__*)
    OP="${TOOL#mcp__gk__}"
    SERVER="gk"
    ;;
  mcp__gitkraken__*)
    OP="${TOOL#mcp__gitkraken__}"
    SERVER="gk"
    ;;
  mcp__GitKraken__*)
    OP="${TOOL#mcp__GitKraken__}"
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

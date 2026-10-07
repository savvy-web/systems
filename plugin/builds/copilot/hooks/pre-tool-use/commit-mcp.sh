#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/pluginfinity/hook.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
# shellcheck source=../lib/silk/hook-env.sh
. "$(dirname "$0")/../lib/silk/hook-env.sh"

hook_require_input
TOOL=$(hook_input tool_name)
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

ALLOW="${SILK_HOOK_LIB}/safe-mcp-${SERVER}-ops.txt"
if [ ! -f "$ALLOW" ]; then exit 0; fi

# Strip comments / blanks and match the op against the allow-list as a
# whole-line fixed string.
if grep -vE '^[[:space:]]*(#|$)' "$ALLOW" | grep -Fxq "$OP"; then
  hook_allow "auto-allowed MCP tool: $TOOL"
fi
exit 0

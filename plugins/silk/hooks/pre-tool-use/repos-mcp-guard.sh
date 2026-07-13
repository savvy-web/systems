#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (matcher: the commit-mcp.sh GitKraken/GitHub MCP regex) --
# deny MCP tool calls whose op is in the write set AND whose tool_input
# (stringified) mentions ".repos/". This is a TRIPWIRE, not a security
# boundary -- see repos-bash-guard.sh's header for the shared accepted-miss
# posture (this hook inherits the same one: it only pattern-matches the
# stringified tool_input, so an indirection that keeps the literal
# substring ".repos/" out of every field is a documented miss).
#
# This hook ONLY ever denies or stays silent -- it never allows. It composes
# with commit-mcp.sh on the same matcher: deny from either hook wins, so a
# write op NOT targeting .repos/ still falls through to commit-mcp.sh's
# normal allow-list / prompt-gated flow.
#
# Fails open: no jq, a malformed envelope, or a non-matching tool_name all
# fall through to a silent exit 0.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/repos-mcp-guard"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"

TOOL=$(jq -r '.tool_name // empty' <<< "$HOOK_ENVELOPE")
[ -z "$TOOL" ] && exit 0

# Same server/op split as commit-mcp.sh (mcp__gk__*, mcp__gitkraken__*,
# mcp__GitKraken__*, mcp__github__*, mcp__github-<scope>__*). Only the op
# suffix matters here -- the write-op set below is identical across both
# servers.
case "$TOOL" in
	mcp__gk__*)
		OP="${TOOL#mcp__gk__}"
		;;
	mcp__gitkraken__*)
		OP="${TOOL#mcp__gitkraken__}"
		;;
	mcp__GitKraken__*)
		OP="${TOOL#mcp__GitKraken__}"
		;;
	mcp__github__*)
		OP="${TOOL#mcp__github__}"
		;;
	mcp__github-*__*)
		REST="${TOOL#mcp__github-}"
		OP="${REST#*__}"
		;;
	*)
		exit 0
		;;
esac

case "$OP" in
	git_add_or_commit|git_push|git_branch|git_checkout|git_stash|git_worktree|create_or_update_file|delete_file|push_files)
		;;
	*)
		exit 0
		;;
esac

INPUT_STR=$(jq -r '.tool_input | tostring' <<< "$HOOK_ENVELOPE")
if [[ "$INPUT_STR" == *.repos/* ]]; then
	emit_deny "MCP writes inside .repos/** are denied; re-pin via repos_manage (action: pin)."
fi
exit 0

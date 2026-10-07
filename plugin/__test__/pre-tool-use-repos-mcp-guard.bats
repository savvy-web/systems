#!/usr/bin/env bats
# __test__/pre-tool-use-repos-mcp-guard.bats
#
# Coverage for hooks/pre-tool-use/repos-mcp-guard.sh: a best-effort tripwire
# that denies MCP tool calls whose op is in the write set (git_add_or_commit,
# git_push, git_branch, git_checkout, git_stash, git_worktree,
# create_or_update_file, delete_file, push_files) AND whose tool_input
# (stringified) mentions ".repos/". Everything else -- read ops, write ops
# that don't target .repos, non-matching tool names -- exits 0 silently and
# falls through to commit-mcp.sh's normal allow/prompt flow on the same
# matcher.

load common

HOOK="hooks/pre-tool-use/repos-mcp-guard.sh"

silk_file_setup() {
	common_setup
}

_decision() {
	jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision) // empty' <<< "$1"
}

_reason() {
	jq -r '(.hookSpecificOutput.permissionDecisionReason // .permissionDecisionReason) // empty' <<< "$1"
}

@test "git_add_or_commit targeting a .repos/** directory: deny naming repos_manage pin" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.repos-mcp-write.json"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"repos_manage"* ]]
	[[ "$reason" == *"pin"* ]]
	done
}

@test "git_status (read op) targeting the same .repos/** directory: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.repos-mcp-read.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "git_add_or_commit NOT targeting .repos/**: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.repos-mcp-write-elsewhere.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "non-matching tool name (Bash): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-non-matching.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "malformed JSON input: no-op (fails open)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run_stdin "$HOOK" 'not json'
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

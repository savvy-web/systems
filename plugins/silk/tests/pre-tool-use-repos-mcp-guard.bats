#!/usr/bin/env bats
# tests/pre-tool-use-repos-mcp-guard.bats
#
# Coverage for hooks/pre-tool-use/repos-mcp-guard.sh: a best-effort tripwire
# that denies MCP tool calls whose op is in the write set (git_add_or_commit,
# git_push, git_branch, git_checkout, git_stash, git_worktree,
# create_or_update_file, delete_file, push_files) AND whose tool_input
# (stringified) mentions ".repos/". Everything else -- read ops, write ops
# that don't target .repos, non-matching tool names -- exits 0 silently and
# falls through to commit-mcp.sh's normal allow/prompt flow on the same
# matcher.

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/repos-mcp-guard.sh"

setup() {
	common_setup
}

_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

_reason() {
	jq -r '.hookSpecificOutput.permissionDecisionReason // empty' <<< "$1"
}

@test "git_add_or_commit targeting a .repos/** directory: deny naming repos_manage pin" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-mcp-write.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"repos_manage"* ]]
	[[ "$reason" == *"pin"* ]]
}

@test "git_status (read op) targeting the same .repos/** directory: silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-mcp-read.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "git_add_or_commit NOT targeting .repos/**: silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-mcp-write-elsewhere.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "non-matching tool name (Bash): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-non-matching.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "malformed JSON input: no-op (fails open)" {
	run bash -c "printf 'not json' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

#!/usr/bin/env bats
# tests/pre-tool-use-commit-mcp.bats
#
# Coverage for hooks/pre-tool-use/commit-mcp.sh: auto-allow read-ish MCP
# operations whose op suffix appears in the per-server allow-list
# (lib/safe-mcp-<server>-ops.txt). Contract: allowed ops emit an `allow`
# decision; anything else (unlisted op, unknown server, non-MCP tool, empty
# tool_name) exits 0 silently with no output.

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/commit-mcp.sh"

setup() {
	common_setup
}

# jq helper — read the permission decision out of the hook's JSON output.
_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

@test "gk read op in allow-list (git_status): allow" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gk-read.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	[[ "$output" == *"mcp__gk__git_status"* ]]
}

@test "gk op NOT in allow-list (git_reflog): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gk-unlisted.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "gitkraken server name, read op in allow-list (git_status): allow" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gitkraken-read.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	[[ "$output" == *"mcp__gitkraken__git_status"* ]]
}

@test "GitKraken cased server name, read op in allow-list (git_log_or_diff): allow" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gitkraken-cased-read.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	[[ "$output" == *"mcp__GitKraken__git_log_or_diff"* ]]
}

@test "gitkraken git_push NOT auto-allowed (would bypass changeset-push-guard): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gitkraken-push.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "gitkraken git_add_or_commit NOT auto-allowed (would bypass commit validation): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gitkraken-commit.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "unscoped github read op (list_issues): allow" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-github-read.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
}

@test "scoped github server (mcp__github-savvy-web__list_issues): allow (scope peeled)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-github-scoped-read.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	[[ "$output" == *"mcp__github-savvy-web__list_issues"* ]]
}

@test "github op NOT in allow-list (delete_file): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-github-unlisted.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "non-MCP tool name (Bash): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-non-matching.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "empty tool_name: silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-empty.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "malformed JSON input: non-zero exit (jq parse error), no decision emitted" {
	# Documents CURRENT behaviour: the hook jq-parses stdin without a fail-open
	# guard for invalid JSON, so a parse error aborts under `set -e`.
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -ne 0 ]
	[ -z "$output" ]
}

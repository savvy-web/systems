#!/usr/bin/env bats
# __test__/pre-tool-use-commit-mcp.bats
#
# Coverage for hooks/pre-tool-use/commit-mcp.sh: auto-allow read-ish MCP
# operations whose op suffix appears in the per-server allow-list
# (lib/safe-mcp-<server>-ops.txt). Contract: allowed ops emit an `allow`
# decision; anything else (unlisted op, unknown server, non-MCP tool, empty
# tool_name) exits 0 silently with no output.

load common

HOOK="hooks/pre-tool-use/commit-mcp.sh"

silk_file_setup() {
	common_setup
}

# jq helper — read the permission decision out of the hook's JSON output.
_decision() {
	jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision) // empty' <<< "$1"
}

@test "gk read op in allow-list (git_status): allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-gk-read.json"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	# hook_allow carries the plugins/silk reason again (pluginfinity 0.3.0).
	[[ "$(_reason)" == "auto-allowed MCP tool: mcp__"* ]]
	done
}

@test "gk op NOT in allow-list (git_reflog): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-gk-unlisted.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "gitkraken server name, read op in allow-list (git_status): allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-gitkraken-read.json"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	# hook_allow carries the plugins/silk reason again (pluginfinity 0.3.0).
	[[ "$(_reason)" == "auto-allowed MCP tool: mcp__"* ]]
	done
}

@test "GitKraken cased server name, read op in allow-list (git_log_or_diff): allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-gitkraken-cased-read.json"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	# hook_allow carries the plugins/silk reason again (pluginfinity 0.3.0).
	[[ "$(_reason)" == "auto-allowed MCP tool: mcp__"* ]]
	done
}

@test "gitkraken git_push NOT auto-allowed (remote-mutating op stays prompt-gated): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-gitkraken-push.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "gitkraken git_add_or_commit NOT auto-allowed (would bypass commit validation): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-gitkraken-commit.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "unscoped github read op (list_issues): allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-github-read.json"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	done
}

@test "scoped github server (mcp__github-savvy-web__list_issues): allow (scope peeled)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-github-scoped-read.json"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	# hook_allow carries the plugins/silk reason again (pluginfinity 0.3.0).
	[[ "$(_reason)" == "auto-allowed MCP tool: mcp__"* ]]
	done
}

@test "github op NOT in allow-list (delete_file): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-github-unlisted.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "non-MCP tool name (Bash): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-non-matching.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "empty tool_name: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.mcp-empty.json"
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

#!/usr/bin/env bats
# tests/pre-tool-use-repos-bash-guard.bats
#
# Coverage for hooks/pre-tool-use/repos-bash-guard.sh: a best-effort tripwire
# that denies shell commands whose COMMAND string visibly writes into
# "${PROJECT_DIR}/.repos/**" (vendored, read-only reference source).
# ".repos/config.json" stays hand-editable. This is NOT a security boundary
# -- see the header comment in repos-bash-guard.sh for the accepted,
# documented misses (persisted `cd`, command substitution, exotic
# indirection). Unlike biome-prefer-mcp.sh, this hook does NOT exempt
# subagent calls.
#
# Deny-path fixture pattern copied from pre-tool-use-repos-fs-guard.bats --
# see tests/README.md "Deny-path fixture pattern".

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/repos-bash-guard.sh"

setup() {
	common_setup
}

_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

_reason() {
	jq -r '.hookSpecificOutput.permissionDecisionReason // empty' <<< "$1"
}

@test "git -C .repos/<repo> checkout (write subcommand): deny naming repos_manage pin" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-write.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"repos_manage"* ]]
	[[ "$reason" == *"pin"* ]]
}

@test "git -C .repos/<repo> log (read subcommand, allow-listed): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-read.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "shell redirect into .repos/** : deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-redirect.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "sed -i targeting .repos/** : deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-sed.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "redirect append into .repos/config.json (the hand-editable exception): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-config-allow.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "rg read over .repos/** : silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-rg.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "command with no .repos mention: silent no-op (cheap early-out)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-unrelated.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "non-Bash tool_name: silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-mcp-write.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "malformed JSON input: no-op (fails open)" {
	run bash -c "printf 'not json' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

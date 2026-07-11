#!/usr/bin/env bats
# tests/session-start-orientation.bats
#
# Coverage for hooks/session-start/orientation.sh: on every session start,
# persist the 5 SILK_* exports into the per-session env file (and, when set,
# CLAUDE_ENV_FILE), and emit SessionStart additionalContext with the
# workspace / changesets / dogfood-feedback orientation.
#
# No CLI shell-out — this hook is pure jq + file writes, so it needs no stubs;
# HOME isolation (common_setup) keeps the env-file writes inside the tmp tree.

load 'test_helper'

HOOK="${HOOKS_DIR}/session-start/orientation.sh"

setup() {
	common_setup
}

@test "emits SessionStart context with the orientation payload" {
	make_project >/dev/null
	run bash -c "cat '${FIXTURES_DIR}/sessionstart.orientation.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"workspace_info"* ]]
	[[ "$ctx" == *"changesets_plugin"* ]]
	[[ "$ctx" == *"dogfood_feedback"* ]]
}

@test "writes the per-session silk-hook.sh env file with the 5 SILK_* exports" {
	make_project >/dev/null
	run bash -c "cat '${FIXTURES_DIR}/sessionstart.orientation.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	local env_file="${HOME}/.claude/session-env/sess-orient-1/silk-hook.sh"
	[ -f "$env_file" ]
	grep -q '^export SILK_PROJECT_DIR=' "$env_file"
	grep -q '^export SILK_DATA_DIR=' "$env_file"
	grep -q '^export SILK_PLUGIN_ROOT=' "$env_file"
	grep -q '^export SILK_SESSION_ID=' "$env_file"
	grep -q '^export SILK_PACKAGE_MANAGER=' "$env_file"
}

@test "detects pnpm from package.json and records it in the env file" {
	export CLAUDE_PROJECT_DIR="${BATS_TEST_TMPDIR}/pnpm-proj"
	mkdir -p "$CLAUDE_PROJECT_DIR"
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	run bash -c "cat '${FIXTURES_DIR}/sessionstart.orientation.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	local env_file="${HOME}/.claude/session-env/sess-orient-1/silk-hook.sh"
	grep -q "^export SILK_PACKAGE_MANAGER=pnpm$" "$env_file"
}

@test "appends the exports to CLAUDE_ENV_FILE when it is set" {
	make_project >/dev/null
	export CLAUDE_ENV_FILE="${BATS_TEST_TMPDIR}/claude-env.sh"
	: > "$CLAUDE_ENV_FILE"
	run bash -c "cat '${FIXTURES_DIR}/sessionstart.orientation.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	grep -q '^export SILK_PROJECT_DIR=' "$CLAUDE_ENV_FILE"
	grep -q '^export SILK_SESSION_ID=' "$CLAUDE_ENV_FILE"
}

@test "no session_id: still emits context, writes no env file" {
	make_project >/dev/null
	local envelope="${BATS_TEST_TMPDIR}/no-sid.json"
	jq 'del(.session_id)' "${FIXTURES_DIR}/sessionstart.orientation.json" > "$envelope"
	run bash -c "cat '${envelope}' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	[ ! -d "${HOME}/.claude/session-env" ]
}

@test "malformed JSON input: non-zero exit (jq parse error)" {
	make_project >/dev/null
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -ne 0 ]
	[ -z "$output" ]
}

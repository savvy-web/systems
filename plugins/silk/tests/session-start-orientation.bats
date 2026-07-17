#!/usr/bin/env bats
# tests/session-start-orientation.bats
#
# Coverage for hooks/session-start/orientation.sh: on every session start,
# persist the 5 SILK_* exports into the per-session env file (and, when set,
# CLAUDE_ENV_FILE), and emit SessionStart additionalContext with the
# <silk_capabilities> surface (MCP tool, agent, and skill indexes).
#
# This hook is the PRODUCER of SILK_PROJECT_DIR / SILK_PACKAGE_MANAGER. It
# resolves its project dir through resolve_project_dir and its package manager
# through detect_package_manager (both hooks/lib/hook-env.sh, shared with
# startup-only.sh), so the precedence and fail-open cases below are the contract
# every reader hook inherits.
#
# No CLI shell-out — this hook is pure jq + file writes, so it needs no stubs;
# HOME isolation (common_setup) keeps the env-file writes inside the tmp tree.

load 'test_helper'

HOOK="${HOOKS_DIR}/session-start/orientation.sh"
ENV_FILE_REL="/.claude/session-env/sess-orient-1/silk-hook.sh"

setup() {
	common_setup
}

@test "emits SessionStart context with the orientation payload" {
	make_project >/dev/null
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"silk_capabilities"* ]]
	[[ "$ctx" == *"workspace_info"* ]]
	[[ "$ctx" == *"biome_check"* ]]
	[[ "$ctx" == *"changeset_inspect"* ]]
	[[ "$ctx" == *"/silk:commit-create"* ]]
	[[ "$ctx" == *"/silk:dogfood"* ]]
	[[ "$ctx" == *"dogfood-mail"* ]]
	[[ "$ctx" == *"it2"* ]]
}

@test "writes the per-session silk-hook.sh env file with the 5 SILK_* exports" {
	make_project >/dev/null
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	local env_file="${HOME}${ENV_FILE_REL}"
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
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	grep -q "^export SILK_PACKAGE_MANAGER=pnpm$" "${HOME}${ENV_FILE_REL}"
}

@test "detects yarn from a lockfile when package.json declares no packageManager" {
	export CLAUDE_PROJECT_DIR="${BATS_TEST_TMPDIR}/yarn-proj"
	mkdir -p "$CLAUDE_PROJECT_DIR"
	printf '{"name":"x"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	: > "${CLAUDE_PROJECT_DIR}/yarn.lock"
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	grep -q "^export SILK_PACKAGE_MANAGER=yarn$" "${HOME}${ENV_FILE_REL}"
}

# savvy-web/systems#274: the envelope's cwd follows a git worktree;
# CLAUDE_PROJECT_DIR is pinned to the primary checkout for the whole session. The
# producer must record the worktree, because every reader hook reads back what it
# wrote — detecting the PRIMARY checkout's package manager here would poison
# SILK_PACKAGE_MANAGER for the entire session.
@test "envelope cwd outranks CLAUDE_PROJECT_DIR (worktree doctrine)" {
	local primary="${BATS_TEST_TMPDIR}/primary"
	local worktree="${BATS_TEST_TMPDIR}/worktree"
	mkdir -p "$primary" "$worktree"
	printf '{"packageManager":"yarn@4.0.0"}\n' > "${primary}/package.json"
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${worktree}/package.json"
	export CLAUDE_PROJECT_DIR="$primary"

	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json" "$worktree")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]

	local env_file="${HOME}${ENV_FILE_REL}"
	grep -q "^export SILK_PACKAGE_MANAGER=pnpm$" "$env_file"
	grep -q "^export SILK_PROJECT_DIR=${worktree}$" "$env_file"
}

@test "no cwd in the envelope: falls back to CLAUDE_PROJECT_DIR" {
	export CLAUDE_PROJECT_DIR="${BATS_TEST_TMPDIR}/fallback-proj"
	mkdir -p "$CLAUDE_PROJECT_DIR"
	printf '{"packageManager":"bun@1.1.0"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	local envelope
	envelope="$(envelope_without_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]

	local env_file="${HOME}${ENV_FILE_REL}"
	grep -q "^export SILK_PACKAGE_MANAGER=bun$" "$env_file"
	grep -q "^export SILK_PROJECT_DIR=${CLAUDE_PROJECT_DIR}$" "$env_file"
}

# detect_package_manager fails open instead of aborting the hook: a cwd that no
# longer exists (stale envelope, deleted worktree) still yields a live session.
@test "nonexistent project dir: package manager falls open to npm, context still emitted" {
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json" "${BATS_TEST_TMPDIR}/gone")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	grep -q "^export SILK_PACKAGE_MANAGER=npm$" "${HOME}${ENV_FILE_REL}"
}

@test "appends the exports to CLAUDE_ENV_FILE when it is set" {
	make_project >/dev/null
	export CLAUDE_ENV_FILE="${BATS_TEST_TMPDIR}/claude-env.sh"
	: > "$CLAUDE_ENV_FILE"
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	grep -q '^export SILK_PROJECT_DIR=' "$CLAUDE_ENV_FILE"
	grep -q '^export SILK_SESSION_ID=' "$CLAUDE_ENV_FILE"
}

@test "no session_id: still emits context, writes no env file" {
	make_project >/dev/null
	local envelope="${BATS_TEST_TMPDIR}/no-sid.json"
	jq --arg d "$CLAUDE_PROJECT_DIR" 'del(.session_id) | .cwd = $d' \
		"${FIXTURES_DIR}/sessionstart.orientation.json" > "$envelope"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	[ ! -d "${HOME}/.claude/session-env" ]
}

@test "malformed JSON input: no-op (fails open)" {
	make_project >/dev/null
	run bash -c "printf 'not json' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

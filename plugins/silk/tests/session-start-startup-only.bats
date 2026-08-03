#!/usr/bin/env bats
# tests/session-start-startup-only.bats
#
# Coverage for hooks/session-start/startup-only.sh (matcher: startup): run the
# `savvy commit hook session-start` side-effect (stdout discarded) and emit the
# Silk-system intro + code-quality orientation.
#
# Project-dir resolution goes through resolve_project_dir (hooks/lib/hook-env.sh)
# — envelope .cwd first, then SILK_PROJECT_DIR / CLAUDE_PROJECT_DIR — the same
# helper orientation.sh uses, so the two SessionStart hooks agree on the working
# tree. If nothing resolves, the hook emits a no-op (a SessionStart cannot block).
#
# The hook parses the envelope only through that helper: a MALFORMED body must
# still emit the code-quality context (it is unconditional session orientation,
# not a decision about a tool call), so unlike every other jq-parsing hook it
# does NOT call read_envelope_or_noop.
#
# The context-emitting path pins the runner to npm and stubs `npx` so the real
# savvy CLI is never invoked.

load 'test_helper'

HOOK="${HOOKS_DIR}/session-start/startup-only.sh"

setup() {
	common_setup
}

stub_ok_npx() {
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
}

@test "no cwd and no CLAUDE_PROJECT_DIR: no-op (cannot block a SessionStart)" {
	# common_setup already unset CLAUDE_PROJECT_DIR / SILK_PROJECT_DIR.
	local envelope
	envelope="$(envelope_without_cwd "${FIXTURES_DIR}/sessionstart.startup.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "with a project dir: emits the code-quality orientation context" {
	make_project >/dev/null
	stub_ok_npx
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"silk_system"* ]]
	[[ "$ctx" == *"useImportExtensions"* ]]
	[[ "$ctx" == *"pre_commit_pipeline"* ]]
	[[ "$ctx" == *"chmod -x"* ]]
	# The lint-staged config path is interpolated from the RESOLVED project dir,
	# not from CLAUDE_PROJECT_DIR directly.
	[[ "$ctx" == *"${CLAUDE_PROJECT_DIR}/lib/configs/lint-staged.config.ts"* ]]
}

# savvy-web/systems#274: the envelope's cwd follows a git worktree. This hook
# used to hard-require CLAUDE_PROJECT_DIR while orientation.sh fell back to the
# envelope; both now resolve identically through resolve_project_dir.
@test "envelope cwd resolves the project dir even with CLAUDE_PROJECT_DIR unset" {
	local worktree="${BATS_TEST_TMPDIR}/worktree"
	mkdir -p "$worktree"
	stub_ok_npx
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json" "$worktree")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"${worktree}/lib/configs/lint-staged.config.ts"* ]]
}

@test "envelope cwd outranks CLAUDE_PROJECT_DIR (worktree doctrine)" {
	local primary="${BATS_TEST_TMPDIR}/primary"
	local worktree="${BATS_TEST_TMPDIR}/worktree"
	mkdir -p "$primary" "$worktree"
	export CLAUDE_PROJECT_DIR="$primary"
	stub_ok_npx
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json" "$worktree")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"${worktree}/lib/configs/lint-staged.config.ts"* ]]
	[[ "$ctx" != *"${primary}/lib/configs/lint-staged.config.ts"* ]]
}

@test "pnpm project: the runner strings in the context resolve to pnpm exec" {
	export CLAUDE_PROJECT_DIR="${BATS_TEST_TMPDIR}/pnpm-proj"
	mkdir -p "$CLAUDE_PROJECT_DIR"
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	use_stub_bin
	write_stub pnpm <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"pnpm run lint"* ]]
	[[ "$ctx" == *"pnpm run lint:fix"* ]]
	[[ "$ctx" == *"pnpm run lint:fix:unsafe"* ]]
	[[ "$ctx" != *"pnpm exec biome"* ]]
	[[ "$ctx" == *"pnpm run typecheck"* ]]
}

@test "side-effect CLI failure does not block: context still emitted" {
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
echo 'session-start side effect exploded' >&2
exit 1
STUB
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
}

@test "malformed body with a project dir: still emits context (fails open)" {
	make_project >/dev/null
	stub_ok_npx
	run bash -c "printf 'not json at all' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"useImportExtensions"* ]]
}

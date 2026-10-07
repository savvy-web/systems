#!/usr/bin/env bats
# __test__/session-start-startup-only.bats
#
# Coverage for hooks/session-start/startup-only.sh (matcher: startup): run the
# `savvy commit hook session-start` side-effect (stdout discarded) and emit the
# Silk-system intro + code-quality orientation.
#
# Project-dir resolution goes through the library's hook_project_dir — envelope
# .cwd walked up to its .git first, then CLAUDE_PROJECT_DIR, then $PWD — the
# same call orientation.sh makes, so the two SessionStart hooks agree on the
# working tree. It never comes back empty.
#
# A MALFORMED body must still emit the code-quality context (it is unconditional
# session orientation, not a decision about a tool call), so unlike every other
# hook it does NOT call hook_require_input; the build's PLUGINFINITY_EVENT names
# the event when the payload cannot.
#
# The context-emitting path pins the runner to npm and stubs `npx` so the real
# savvy CLI is never invoked.

load common

HOOK="hooks/session-start/startup-only.sh"

silk_file_setup() {
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

# hook_project_dir never comes back empty, so the old "nothing resolves: no-op"
# branch is gone; the hook falls back to $PWD and still orients. Neither host
# sends a SessionStart without cwd.
@test "no cwd and no CLAUDE_PROJECT_DIR: still emits the orientation (exit 0)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	# common_setup already unset CLAUDE_PROJECT_DIR / SILK_PROJECT_DIR.
	stub_ok_npx
	local envelope
	envelope="$(envelope_without_cwd "${FIXTURES_DIR}/sessionstart.startup.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	[[ "$(_context)" == *"silk_system"* ]]
	done
}

@test "with a project dir: emits the code-quality orientation context" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	stub_ok_npx
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	expect_event_name SessionStart
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	[[ "$ctx" == *"silk_system"* ]]
	[[ "$ctx" == *"useImportExtensions"* ]]
	[[ "$ctx" == *"pre_commit_pipeline"* ]]
	[[ "$ctx" == *"chmod -x"* ]]
	# The lint-staged config path is interpolated from the RESOLVED project dir,
	# not from CLAUDE_PROJECT_DIR directly.
	[[ "$ctx" == *"${CLAUDE_PROJECT_DIR}/lib/configs/lint-staged.config.ts"* ]]
	done
}

# savvy-web/systems#274: the envelope's cwd follows a git worktree. This hook
# used to hard-require CLAUDE_PROJECT_DIR while orientation.sh fell back to the
# envelope; both now resolve identically through hook_project_dir. The trees are
# real git repos/worktrees, so the cwd is walked up to the worktree root (a
# non-git cwd is taken as given: see the non-git test below).
@test "envelope cwd resolves the project dir even with CLAUDE_PROJECT_DIR unset" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local primary worktree
	primary="$(init_push_repo)"
	worktree="$(add_worktree "$primary" wt-startup)"
	unset CLAUDE_PROJECT_DIR
	stub_ok_npx
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json" "$worktree")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	[[ "$ctx" == *"${worktree}/lib/configs/lint-staged.config.ts"* ]]
	done
}

@test "envelope cwd outranks CLAUDE_PROJECT_DIR (worktree doctrine)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local primary worktree
	primary="$(init_push_repo)"
	worktree="$(add_worktree "$primary" wt-startup)"
	export CLAUDE_PROJECT_DIR="$primary"
	stub_ok_npx
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json" "$worktree")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	[[ "$ctx" == *"${worktree}/lib/configs/lint-staged.config.ts"* ]]
	[[ "$ctx" != *"${primary}/lib/configs/lint-staged.config.ts"* ]]
	done
}

# A cwd in a subdirectory of the worktree resolves to the worktree root.
@test "envelope cwd in a worktree subdirectory resolves to the worktree root" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local primary worktree
	primary="$(init_push_repo)"
	worktree="$(add_worktree "$primary" wt-startup)"
	mkdir -p "${worktree}/packages/a"
	export CLAUDE_PROJECT_DIR="$primary"
	stub_ok_npx
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json" "${worktree}/packages/a")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	[[ "$(_context)" == *"${worktree}/lib/configs/lint-staged.config.ts"* ]]
	done
}

# plugins/silk resolved a non-git cwd as given, ahead of CLAUDE_PROJECT_DIR
# (#274); since pluginfinity round 2 hook_project_dir does too, on both hosts.
@test "non-git envelope cwd outranks CLAUDE_PROJECT_DIR (plugins/silk contract)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local primary="${SILK_TMP}/primary" plain="${SILK_TMP}/plain"
	mkdir -p "$primary" "$plain"
	export CLAUDE_PROJECT_DIR="$primary"
	stub_ok_npx
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json" "$plain")"
	silk_run "$HOOK" "${envelope}"
	[[ "$(_context)" == *"${plain}/lib/configs/lint-staged.config.ts"* ]]
	done
}

@test "pnpm project: the runner strings in the context resolve to pnpm exec" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	export CLAUDE_PROJECT_DIR="${SILK_TMP}/pnpm-proj"
	mkdir -p "$CLAUDE_PROJECT_DIR"
	git -C "$CLAUDE_PROJECT_DIR" init -q -b main
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	use_stub_bin
	write_stub pnpm <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	[[ "$ctx" == *"pnpm run lint"* ]]
	[[ "$ctx" == *"pnpm run lint:fix"* ]]
	[[ "$ctx" == *"pnpm run lint:fix:unsafe"* ]]
	[[ "$ctx" != *"pnpm exec biome"* ]]
	[[ "$ctx" == *"pnpm run typecheck"* ]]
	done
}

@test "side-effect CLI failure does not block: context still emitted" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
echo 'session-start side effect exploded' >&2
exit 1
STUB
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.startup.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	expect_event_name SessionStart
	done
}

# plugins/silk emitted the code-quality context for a malformed body; that is
# restored. The library reads the body as {}, and hook_event takes the event
# from PLUGINFINITY_EVENT, which the build now sets on every entry of both hosts.
@test "malformed body: still emits the code-quality context" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	stub_ok_npx
	silk_run_stdin "$HOOK" 'not json at all' SessionStart
	[ "$status" -eq 0 ]
	expect_event_name SessionStart
	[[ "$(_context)" == *"silk_system"* ]]
	[[ "$(_context)" == *"useImportExtensions"* ]]
	done
}

# Without PLUGINFINITY_EVENT (a hand run, or a pre-0.3.0 entry) a malformed body
# names no event, so hook_context cannot answer and the hook stays silent.
@test "malformed body, no PLUGINFINITY_EVENT: no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	stub_ok_npx
	silk_run_stdin "$HOOK" 'not json at all'
	[ "$status" -eq 0 ]
	assert_hook_noop
	done
}

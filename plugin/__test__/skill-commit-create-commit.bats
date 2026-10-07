#!/usr/bin/env bats
# __test__/skill-commit-create-commit.bats
#
# Coverage for skills/commit-create/scripts/commit.sh — the wrapper that
# validates a candidate message file and, only on success, execs the real
# `git commit -F`. Its whole purpose is closing a bypass observed live: an
# agent ran a length check, saw a violation, and ran `git commit` anyway
# because the check and the commit were two separate, unconditional
# commands. These tests assert the two things that actually matter for that
# failure mode:
#   1. A failing validation NEVER results in a commit (repo state unchanged).
#   2. The commit that DOES happen always lands in the resolved project
#      directory, never in whatever directory the script happened to be
#      invoked from (a real bug caught while building this suite — commit.sh
#      must resolve + `cd` to PROJECT_DIR itself; `cd`ing inside
#      validate-message.sh's own subprocess does not carry over).
#
# Like the validate-message.sh suite, commitlint is stubbed via `npx` rather
# than installed for real, to stay compatible with
# .github/workflows/hook-tests.yml (bats/shellcheck/jq only, no Node/pnpm).

load common


# make_git_project — like make_project, but a real git repo with one file
# staged, so `git commit` has something to commit. Tests run from it (the
# agent runs a skill script from its own cwd, and neither host hands a skill
# script a project variable). The tests that prove a caller-set
# CLAUDE_PROJECT_DIR governs where the commit lands WHEN cwd resolution has
# nothing to offer run from a non-git WRONG_CWD and pass that variable
# explicitly: resolve_cli_project_dir (savvy-web/systems#474, #434, #418) tries
# `git -C "$PWD" rev-parse --show-toplevel` FIRST and only falls back to
# CLAUDE_PROJECT_DIR once that fails.
make_git_project() {
	local proj="${SILK_TMP}/git-project"
	mkdir -p "$proj"
	git -C "$proj" init -q -b main
	git -C "$proj" config user.email test@example.com
	git -C "$proj" config user.name "Silk Test"
	echo hi >"${proj}/file.txt"
	git -C "$proj" add file.txt
	mkdir -p "${proj}/lib/configs"
	: >"${proj}/lib/configs/commitlint.config.ts"
	export CLAUDE_PROJECT_DIR="$proj"
	echo "$proj"
}

silk_file_setup() {
	SCRIPT="${PLUGIN_ROOT}/skills/commit-create/scripts/commit.sh"

	common_setup
	force_npm_runner
	use_stub_bin
	# NOT `GIT_PROJECT="$(make_git_project)"` — command substitution runs the
	# function in a subshell, so its `export CLAUDE_PROJECT_DIR=...` would
	# never reach this test process (the same reason test_helper's own
	# make_project is always called as `make_project >/dev/null`, never
	# captured). Call directly so the export lands here, then read it back.
	make_git_project >/dev/null
	GIT_PROJECT="$CLAUDE_PROJECT_DIR"
	# A cwd that is NOT the project dir and is not even a git repo — the
	# script must never depend on inheriting the right cwd from the caller.
	WRONG_CWD="${SILK_TMP}/wrong-cwd"
	mkdir -p "$WRONG_CWD"
	# Scripts run through silk_script (pluginfinity's run_script) from $PWD.
	# Neither host gives a skill script a project variable, so the cwd is its
	# only signal: run from the project, as the agent would. The non-git cwd
	# cases have their own tests below.
	cd "$GIT_PROJECT"
}

_stub_commitlint() {
	local exit_code="$1"
	write_stub npx <<STUB
#!/usr/bin/env bash
exit ${exit_code}
STUB
}

_write_msg() {
	local dest="${SILK_TMP}/msg.txt"
	printf '%s' "$1" >"$dest"
	echo "$dest"
}

@test "usage error when no file argument given" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_script "$SILK_TARGET" skills/commit-create/scripts/commit.sh
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"Usage:"* ]]
	done
}

@test "missing file: error, nothing committed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_script "$SILK_TARGET" skills/commit-create/scripts/commit.sh "${SILK_TMP}/does-not-exist.txt"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"message file not found"* ]]
	run git -C "$GIT_PROJECT" log --oneline
	[ "$status" -ne 0 ]
	done
}

@test "--no-verify is refused before validation even runs" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	run_script "$SILK_TARGET" skills/commit-create/scripts/commit.sh "$msg" -- --no-verify
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"--no-verify/-n is refused"* ]]
	# The refusal is also recorded through pluginfinity's log.sh (script_log).
	grep -q "\[${SILK_TARGET}\] script/commit.sh: refused --no-verify/-n" \
		"${BATS_TEST_TMPDIR}/state/pluginfinity/silk/error.log"
	run git -C "$GIT_PROJECT" log --oneline
	[ "$status" -ne 0 ]
	done
}

@test "-n (short form of --no-verify) is also refused" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/commit.sh "$msg" -- -n
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"refused"* ]]
	done
}

# Neither host gives a skill script a project variable, so from a cwd outside
# any repository there is nothing to fall back to: the script blocks (the
# commitlint config is resolved against the cwd) and nothing is committed.
@test "a non-git cwd with no project variable blocks, nothing committed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	cd "$WRONG_CWD"
	local msg
	msg=$(_write_msg $'chore: add test file\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/commit.sh "$msg"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"COMMIT BLOCKED"* ]]
	run git -C "$GIT_PROJECT" log --oneline
	[ "$status" -ne 0 ]
	[ ! -d "${WRONG_CWD}/.git" ]
	done
}

@test "commitlint rejects: commit blocked, repo has zero commits" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 1
	local msg
	msg=$(_write_msg $'chore: bump lockfile.\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/commit.sh "$msg"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"COMMIT BLOCKED"* ]]
	run git -C "$GIT_PROJECT" log --oneline
	[ "$status" -ne 0 ]
	# The staged file must still be staged, untouched.
	run git -C "$GIT_PROJECT" diff --cached --name-only
	[[ "$output" == *"file.txt"* ]]
	done
}

@test "commitlint accepts: real commit created in PROJECT_DIR, not the invocation cwd" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	cd "$WRONG_CWD"
	local msg
	msg=$(_write_msg $'chore: add test file\n\nSigned-off-by: Silk Test <test@example.com>\n')
	# A caller-set CLAUDE_PROJECT_DIR (rule 5's fallback): no host gives a
	# skill script one, so the test passes it explicitly.
	silk_script skills/commit-create/scripts/commit.sh --env CLAUDE_PROJECT_DIR="$GIT_PROJECT" "$msg"
	[ "$status" -eq 0 ]
	run git -C "$GIT_PROJECT" log -1 --format='%s'
	[ "$output" = "chore: add test file" ]
	# The wrong cwd must never have become a git repo or received the commit.
	[ ! -d "${WRONG_CWD}/.git" ]
	done
}

@test "relative message-file path resolves against the invocation cwd, not PROJECT_DIR" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	# From a cwd that is not the project (a caller-set CLAUDE_PROJECT_DIR
	# names it), so the relative path can only resolve against the cwd.
	cd "$WRONG_CWD"
	printf '%s' $'chore: add test file\n\nSigned-off-by: Silk Test <test@example.com>\n' >"${PWD}/msg.txt"
	silk_script skills/commit-create/scripts/commit.sh --env CLAUDE_PROJECT_DIR="$GIT_PROJECT" "msg.txt"
	[ "$status" -eq 0 ]
	run git -C "$GIT_PROJECT" log -1 --format='%s'
	[ "$output" = "chore: add test file" ]
	done
}

@test "-- passthrough args reach git commit (e.g. --amend)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local first_msg second_msg
	first_msg=$(_write_msg $'chore: first commit\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/commit.sh "$first_msg"
	[ "$status" -eq 0 ]

	second_msg=$(_write_msg $'chore: amended commit\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/commit.sh "$second_msg" -- --amend
	[ "$status" -eq 0 ]

	run git -C "$GIT_PROJECT" log --oneline
	[ "${#lines[@]}" -eq 1 ]
	run git -C "$GIT_PROJECT" log -1 --format='%s'
	[ "$output" = "chore: amended commit" ]
	done
}

# --- resolve-cli-project-dir.sh end-to-end coverage (savvy-web/systems#474,
# #434, #418) — the actual field reproductions: an agent working in a
# `.claude/worktrees/agent-*/` worktree whose commit landed in the primary
# checkout instead, and a cross-repo agent whose commit could have landed in
# the wrong repository entirely. The unit-level resolution rules are covered
# directly in tests/skill-commit-create-validate-message.bats; these two
# confirm the full commit.sh pipeline honors them.

@test "cwd inside a git worktree: commit lands in the worktree, the CLAUDE_PROJECT_DIR-pinned primary checkout untouched" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	# GIT_PROJECT stages file.txt but leaves lib/configs/commitlint.config.ts
	# untracked (see make_git_project); `git worktree add` only checks out
	# COMMITTED content, so without staging the config too, the new worktree
	# would be missing the file validate-message.sh hard-requires. `git
	# worktree add` also needs a real ref to branch from, so commit both now.
	git -C "$GIT_PROJECT" add -A
	git -C "$GIT_PROJECT" commit -q -m "chore: seed"
	local wt="${SILK_TMP}/wt"
	git -C "$GIT_PROJECT" worktree add -q -b feature "$wt" main
	echo "wt-only" >"${wt}/wt-file.txt"
	git -C "$wt" add wt-file.txt
	cd "$wt"
	local msg
	msg=$(_write_msg $'chore: commit from the worktree\n\nSigned-off-by: Silk Test <test@example.com>\n')
	# A caller-set CLAUDE_PROJECT_DIR pinned to the primary checkout; the
	# worktree cwd must still win.
	silk_script skills/commit-create/scripts/commit.sh --env CLAUDE_PROJECT_DIR="$GIT_PROJECT" "$msg"
	[ "$status" -eq 0 ]
	run git -C "$wt" log -1 --format='%s'
	[ "$output" = "chore: commit from the worktree" ]
	# The primary checkout named by CLAUDE_PROJECT_DIR must stay exactly at
	# its one seed commit -- the #474/#434 failure mode this closes is the
	# worktree's commit landing there instead.
	run git -C "$GIT_PROJECT" log --oneline
	[ "${#lines[@]}" -eq 1 ]
	done
}

@test "cwd inside a git worktree: an inherited SILK_PROJECT_DIR naming the primary checkout does not redirect the commit (#706)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	git -C "$GIT_PROJECT" add -A
	git -C "$GIT_PROJECT" commit -q -m "chore: seed"
	local wt="${SILK_TMP}/wt"
	git -C "$GIT_PROJECT" worktree add -q -b feature "$wt" main
	echo "wt-only" >"${wt}/wt-file.txt"
	git -C "$wt" add wt-file.txt
	# Something staged in the primary checkout too: the #706 hazard is this
	# landing on the wrong branch.
	echo "main-only" >"${GIT_PROJECT}/main-file.txt"
	git -C "$GIT_PROJECT" add main-file.txt
	cd "$wt"
	local msg
	msg=$(_write_msg $'chore: commit from the worktree\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/commit.sh --env SILK_PROJECT_DIR="$GIT_PROJECT" "$msg"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"NOTICE: ignoring SILK_PROJECT_DIR (${GIT_PROJECT})"* ]]
	run git -C "$wt" log -1 --format='%s'
	[ "$output" = "chore: commit from the worktree" ]
	run git -C "$GIT_PROJECT" log --oneline
	[ "${#lines[@]}" -eq 1 ]
	done
}

@test "CLAUDE_PROJECT_DIR naming a genuinely different repo than cwd: refuses, nothing committed anywhere" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local decoy="${SILK_TMP}/decoy-repo"
	mkdir -p "$decoy"
	git -C "$decoy" init -q -b main
	git -C "$decoy" config user.email test@example.com
	git -C "$decoy" config user.name "Silk Test"
	git -C "$decoy" commit -q --allow-empty -m "chore: decoy seed"
	cd "$decoy"
	local msg
	msg=$(_write_msg $'chore: should never land anywhere\n\nSigned-off-by: Silk Test <test@example.com>\n')
	# Neither host gives a skill script CLAUDE_PROJECT_DIR; a caller that sets
	# it to another repo is the #418 hazard, and the script reads it the same on
	# both hosts.
	silk_script skills/commit-create/scripts/commit.sh --env CLAUDE_PROJECT_DIR="$GIT_PROJECT" "$msg"
	[ "$status" -ne 0 ]
	[[ "$stderr" == *"refusing to guess the target repository"* ]]
	# Neither the cwd repo nor the repo CLAUDE_PROJECT_DIR names received a
	# commit -- a genuine disagreement must never be silently resolved either
	# way (the #418 cross-repo-agent hazard).
	run git -C "$decoy" log --oneline
	[ "${#lines[@]}" -eq 1 ]
	run git -C "$GIT_PROJECT" log --oneline
	[ "$status" -ne 0 ]
	done
}

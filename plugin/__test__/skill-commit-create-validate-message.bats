#!/usr/bin/env bats
# __test__/skill-commit-create-validate-message.bats
#
# Coverage for skills/commit-create/scripts/validate-message.sh. Unlike the
# hooks/** suites, this script is not a hook (no JSON envelope in, no JSON
# decision out) — it is a plain CLI script the commit-create skill mandates
# running before `git commit`. Its pass/fail authority is the REAL
# commitlint preset invoked via the project's package-manager runner, so —
# matching the "stub the CLI, never invoke the real toolchain in tests"
# convention this suite already uses for the savvy CLI shell-outs — every
# test here stubs `npx` to stand in for commitlint rather than requiring a
# real pnpm install. This also keeps the suite compatible with
# .github/workflows/hook-tests.yml, which runs bats/shellcheck/jq only and
# deliberately does not install Node.js/pnpm.

load common


silk_file_setup() {
	SCRIPT="${PLUGIN_ROOT}/skills/commit-create/scripts/validate-message.sh"

	common_setup
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	# The script hard-requires this config file to exist before it will even
	# attempt to resolve a runner; the real value never matters to the stub.
	mkdir -p "${CLAUDE_PROJECT_DIR}/lib/configs"
	: >"${CLAUDE_PROJECT_DIR}/lib/configs/commitlint.config.ts"
	# resolve_cli_project_dir now consults `$PWD` FIRST (savvy-web/systems#474,
	# #434, #418): a plain `make_project` tmp dir is not a git repo, so cwd
	# resolution fails there and the script correctly falls back to
	# CLAUDE_PROJECT_DIR -- but the bats process's OWN cwd is inside this very
	# git checkout, and without this `cd` that real repo would win instead.
	cd "$CLAUDE_PROJECT_DIR"
}

_stub_commitlint() {
	local exit_code="$1"
	# validate-message.sh runs commitlint with --edit <file> and pipes nothing
	# in, so the stub must not read stdin: a stub that drains it blocks forever
	# on an inherited open stdin (it was the last reason run-tests.sh fed bats
	# </dev/null).
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
	run_script "$SILK_TARGET" skills/commit-create/scripts/validate-message.sh
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"Usage:"* ]]
	done
}

@test "missing file: error" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_script "$SILK_TARGET" skills/commit-create/scripts/validate-message.sh "${SILK_TMP}/does-not-exist.txt"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"message file not found"* ]]
	done
}

@test "empty file: error" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local msg="${SILK_TMP}/empty.txt"
	: >"$msg"
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"message file is empty"* ]]
	done
}

@test "valid message, commitlint accepts: exit 0 with PASS" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[ "$status" -eq 0 ]
	[[ "$output" == *"PASS: commit message satisfies the @savvy-web/commitlint preset."* ]]
	[[ "$stderr" != *"MEASURED VIOLATION"* ]]
	done
}

@test "commitlint rejects: exit 1 with FAIL" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 1
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"FAIL: commitlint rejected this message"* ]]
	done
}

@test "body line over 300 chars: measured violation with exact line number and length" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 1
	local long_line
	long_line=$(printf 'x%.0s' $(seq 1 320))
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\n'"${long_line}"$'\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[[ "$stderr" == *"MEASURED VIOLATION: body line 3 is 320 chars (limit 300)"* ]]
	done
}

@test "header over 100 chars: measured violation on line 1" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 1
	local long_subject
	long_subject="feat(auth): $(printf 'x%.0s' $(seq 1 95))"
	local msg
	msg=$(_write_msg "${long_subject}"$'\n\nSigned-off-by: Silk Test <test@example.com>\n')
	local len=${#long_subject}
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[[ "$stderr" == *"MEASURED VIOLATION: header line 1 is ${len} chars (limit 100)"* ]]
	done
}

@test "footer (Signed-off-by) line over 100 chars: measured violation, not misclassified as body" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 1
	local long_signoff
	long_signoff="Signed-off-by: $(printf 'x%.0s' $(seq 1 95)) <test@example.com>"
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\n'"${long_signoff}"$'\n')
	local len=${#long_signoff}
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[[ "$stderr" == *"MEASURED VIOLATION: footer line 3 is ${len} chars (limit 100)"* ]]
	done
}

@test "Closes trailer line counted as footer, not body" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\nExplains the fix in one short line.\n\nCloses #42\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[[ "$output" == *"Footer: longest line"* ]]
	[[ "$stderr" != *"MEASURED VIOLATION"* ]]
	done
}

# The house format separates the Closes line from the signoff with a blank
# line. If the backward footer scan stopped at that blank, only the signoff
# would count as footer and an over-long Closes line would be measured against
# the body's 300 cap — silent here, then rejected by the commit-msg hook. That
# is the exact failure this script exists to prevent, so it gets its own case.
#
# The adjacent-lines test above passes either way; only the blank line
# discriminates.
@test "over-long Closes line separated from signoff by a blank line: measured as footer, not body" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 1
	local long_closes
	# Must exceed FOOTER_MAX=100 to trip the violation — a shorter list is
	# classified as footer correctly but reports nothing, proving nothing.
	long_closes="Closes #101, #102, #103, #104, #105, #106, #107, #108, #109, #110, #111, #112, #113, #114, #115, #116, #117, #118"
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\nExplains the fix in one short line.\n\n'"${long_closes}"$'\n\nSigned-off-by: Silk Test <test@example.com>\n')
	local len=${#long_closes}
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[[ "$stderr" == *"MEASURED VIOLATION: footer line 5 is ${len} chars (limit 100)"* ]]
	[[ "$stderr" != *"MEASURED VIOLATION: body"* ]]
	done
}

@test "blank line between trailers does not swallow the body into the footer" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	# The scan may only cross a blank that sits BETWEEN two trailers. The blank
	# separating the body from the footer must still end it, or a long body
	# line would be measured against the footer's 100 cap instead of 300.
	_stub_commitlint 0
	local long_body
	long_body="- $(printf 'x%.0s' $(seq 1 150))"
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\n'"${long_body}"$'\n\nCloses #42\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[[ "$output" == *"Body: longest line ${#long_body}/300"* ]]
	[[ "$stderr" != *"MEASURED VIOLATION"* ]]
	done
}

@test "single-line message (no body, no footer) does not crash the measurement pass" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 1
	local msg
	msg=$(_write_msg 'chore: bump lockfile')
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[[ "$output" == *"Body: no body lines."* ]]
	[[ "$output" == *"Footer: no trailer lines detected."* ]]
	done
}

# --- resolve-cli-project-dir.sh coverage (savvy-web/systems#474, #434, #418) -
#
# validate-message.sh's own PROJECT_DIR resolution shares resolve_cli_project_dir
# with commit.sh (see hooks/lib/resolve-cli-project-dir.sh). These tests cover
# the shared resolution contract directly, using validate-message.sh because it
# has no side effect (no git commit) to unwind between scenarios.

# _make_git_project_with_config <name> — a REAL git repo (unlike make_project's
# plain tmp dir) with a committed lib/configs/commitlint.config.ts, so
# `git -C "$PWD" rev-parse --show-toplevel` resolves it and the runner
# detection finds the marker file regardless of which candidate directory ends
# up governing the resolution. Echoes the SYMLINK-RESOLVED (`pwd -P`) repo
# path, not anywhere. macOS puts $TMPDIR under a `/var` that is itself a
# symlink to `/private/var`, and `git rev-parse --show-toplevel` always
# returns the canonicalized form — echoing the raw path here would make an
# assertion that embeds this helper's return value disagree with the
# resolver's own output for reasons that have nothing to do with the
# resolution logic under test.
_make_git_project_with_config() {
	local name="$1"
	local repo="${SILK_TMP}/${name}"
	mkdir -p "${repo}/lib/configs"
	: >"${repo}/lib/configs/commitlint.config.ts"
	git -C "$repo" init -q -b main
	git -C "$repo" config user.email test@example.com
	git -C "$repo" config user.name "Silk Test"
	git -C "$repo" add -A
	git -C "$repo" commit -q -m "chore: seed ${name}"
	(cd "$repo" && pwd -P)
}

@test "cwd inside a worktree resolves to the worktree, ignoring a CLAUDE_PROJECT_DIR pinned to the primary checkout" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local main_repo wt
	main_repo=$(_make_git_project_with_config primary)
	wt="${SILK_TMP}/wt"
	git -C "$main_repo" worktree add -q -b feature "$wt" main
	cd "$wt"
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	# Neither host gives a skill script CLAUDE_PROJECT_DIR; this models a
	# caller that sets it (pinned to the primary checkout) explicitly.
	silk_script skills/commit-create/scripts/validate-message.sh --env CLAUDE_PROJECT_DIR="$main_repo" "$msg"
	[ "$status" -eq 0 ]
	[[ "$output" == *"PASS: commit message satisfies the @savvy-web/commitlint preset."* ]]
	# Same repo, different worktree, is an EXPECTED disagreement -- silent,
	# not a NOTICE and not a refusal.
	[[ "$output" != *"NOTICE:"* ]]
	[[ "$output" != *"ERROR: refusing"* ]]
	done
}

@test "SILK_PROJECT_DIR naming a genuinely different repo than cwd refuses (#706)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local claimed decoy
	claimed=$(_make_git_project_with_config claimed)
	decoy=$(_make_git_project_with_config decoy)
	unset CLAUDE_PROJECT_DIR
	export SILK_PROJECT_DIR="$claimed"
	cd "$decoy"
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"ERROR: refusing to guess the target repository"* ]]
	[[ "$stderr" == *"SILK_PROJECT_DIR names a different repository, '${claimed}'"* ]]
	[[ "$stderr" == *"$decoy"* ]]
	[[ "$output" != *"PASS:"* ]]
	done
}

@test "SILK_PROJECT_DIR is the fallback when cwd is outside any git repository" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_commitlint 0
	local target loose
	target=$(_make_git_project_with_config target)
	loose="${SILK_TMP}/loose"
	mkdir -p "$loose"
	unset CLAUDE_PROJECT_DIR
	export SILK_PROJECT_DIR="$target"
	cd "$loose"
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	silk_script skills/commit-create/scripts/validate-message.sh "$msg"
	[ "$status" -eq 0 ]
	[[ "$output" == *"PASS: commit message satisfies the @savvy-web/commitlint preset."* ]]
	done
}

@test "CLAUDE_PROJECT_DIR naming a genuinely different repo than cwd refuses, without SILK_PROJECT_DIR set" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local claimed decoy
	claimed=$(_make_git_project_with_config claimed)
	decoy=$(_make_git_project_with_config decoy)
	unset SILK_PROJECT_DIR
	cd "$decoy"
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	# Neither host gives a skill script CLAUDE_PROJECT_DIR (a skill script run
	# through the Bash tool inherits no plugin variables), so this models a
	# caller that sets it explicitly; the script reads it the same on both.
	silk_script skills/commit-create/scripts/validate-message.sh --env CLAUDE_PROJECT_DIR="$claimed" "$msg"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"ERROR: refusing to guess the target repository"* ]]
	[[ "$stderr" == *"$decoy"* ]]
	[[ "$stderr" == *"$claimed"* ]]
	# The commitlint runner must never even be invoked -- resolution fails
	# before the config-file check or the runner detection ever run.
	[[ "$output" != *"PASS:"* ]]
	[[ "$stderr" != *"FAIL:"* ]]
	done
}

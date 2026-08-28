#!/usr/bin/env bats
# tests/monitor-watch-issues.bats
#
# Coverage for monitors/watch-issues.mjs' provenance gates
# (savvy-web/systems#255). dist/<target>/issues.json is a shared, mutable,
# gitignored artifact, so the monitor reports only what it can vouch for:
#   1. buildOk === true (a crashed build writes an all-zeros artifact);
#   2. the artifact is at least as new as the package's newest source;
#   3. the package's sources are clean (a review tree is broken on purpose).
# Each gate is asserted as SILENCE, since a false positive here has already
# cost committed work (#255).
#
# Driven through `--once`, which reports a stable non-zero count immediately
# and takes no single-instance lock.

load 'test_helper'

MONITOR="${PLUGIN_ROOT}/monitors/watch-issues.mjs"

setup() {
	common_setup
	PROJECT="${BATS_TEST_TMPDIR}/project"
	PKG="${PROJECT}/packages/thing"
	mkdir -p "${PKG}/src" "${PKG}/dist/prod"
	printf 'export const a = 1;\n' > "${PKG}/src/index.ts"
	# Not a git repo: git status fails, so the cleanliness gate makes no claim
	# and the other two gates are what each test isolates. The dirty-tree test
	# below opts INTO git explicitly.
}

# write_issues <buildOk-json> -- write an artifact with one ae-* warning,
# stamped newer than the sources.
write_issues() {
	cat > "${PKG}/dist/prod/issues.json" <<-EOF
	{"package":"@x/thing","target":"prod","buildOk":$1,
	 "warnings":[{"code":"ae-forgotten-export","text":"The symbol \\"Q\\" needs to be exported"}],
	 "errors":[]}
	EOF
	touch "${PKG}/dist/prod/issues.json"
}

run_monitor() {
	run env CLAUDE_PROJECT_DIR="$PROJECT" node "$MONITOR" --once
}

@test "reports a vouched-for artifact" {
	write_issues true
	run_monitor
	[ "$status" -eq 0 ]
	[[ "$output" == *"@x/thing has 1 ae-*/tsdoc- issue in prod"* ]]
}

@test "does not recommend dispatching a fixer" {
	write_issues true
	run_monitor
	[[ "$output" != *"dispatch"* ]]
	[[ "$output" == *"reports an artifact"* ]]
}

@test "silent when buildOk is false (crashed build)" {
	write_issues false
	run_monitor
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "silent when buildOk is absent (unknown provenance)" {
	cat > "${PKG}/dist/prod/issues.json" <<-'EOF'
	{"package":"@x/thing","target":"prod",
	 "warnings":[{"code":"ae-forgotten-export","text":"The symbol \"Q\" needs to be exported"}],
	 "errors":[]}
	EOF
	run_monitor
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "silent when a source file is newer than the artifact" {
	write_issues true
	# The artifact is someone else's gate: it predates this edit.
	touch "${PKG}/src/index.ts"
	run_monitor
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "silent when the package has uncommitted sources" {
	git -C "$PROJECT" init --quiet
	git -C "$PROJECT" add -A
	git -C "$PROJECT" -c user.email=t@t -c user.name=t commit --quiet -m seed
	printf 'export const b = 2;\n' > "${PKG}/src/dirty.ts"
	write_issues true
	run_monitor
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "an uncommitted test file does not silence the monitor" {
	# Gate 3 is scoped to what actually feeds the ae-*/tsdoc- pass. A dirty
	# __test__/*.ts is the normal state during active work and is not an input,
	# so the artifact still describes committed src/ accurately.
	git -C "$PROJECT" init --quiet
	git -C "$PROJECT" add -A
	git -C "$PROJECT" -c user.email=t@t -c user.name=t commit --quiet -m seed
	mkdir -p "${PKG}/__test__"
	printf 'export const t = 1;\n' > "${PKG}/__test__/thing.test.ts"
	write_issues true
	run_monitor
	[ "$status" -eq 0 ]
	[[ "$output" == *"@x/thing has 1 ae-*/tsdoc- issue in prod"* ]]
}

@test "an uncommitted savvy.build.ts does silence the monitor" {
	# The build entry carries meta.tsdoc.suppressWarnings, so it IS an input to
	# the pass — a dirty one means the artifact may not describe committed config.
	git -C "$PROJECT" init --quiet
	git -C "$PROJECT" add -A
	git -C "$PROJECT" -c user.email=t@t -c user.name=t commit --quiet -m seed
	printf 'export default {};\n' > "${PKG}/savvy.build.ts"
	write_issues true
	run_monitor
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "silent on a zero-issue artifact" {
	cat > "${PKG}/dist/prod/issues.json" <<-'EOF'
	{"package":"@x/thing","target":"prod","buildOk":true,"warnings":[],"errors":[]}
	EOF
	run_monitor
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

# --- unlocked fallback (savvy-web/systems#517 review) -----------------------
#
# The read-only-tmp path is the one the `--once` tests above can never reach,
# because `--once` skips the lock entirely. It is also the path whose whole
# purpose is to keep the monitor alive, so a crash here is the exact outcome
# it exists to prevent — it shipped broken once (claimLock returned a bare
# function where main() expected `{ release }`, so `process.on("exit",
# undefined)` threw before the first tick). Resident mode, real unwritable
# tmpdir, assert it both survives and still reports.

@test "runs unlocked and still reports when tmpdir is unwritable" {
	write_issues true
	local rotmp="${BATS_TEST_TMPDIR}/rotmp"
	mkdir -p "$rotmp"
	chmod 500 "$rotmp"

	TMPDIR="${rotmp}/" CLAUDE_PROJECT_DIR="$PROJECT" SILK_TSDOC_MONITOR_STABLE_POLLS=0 \
		node "$MONITOR" > "${BATS_TEST_TMPDIR}/out.log" 2>&1 &
	local pid=$!
	sleep 3

	# The lock file must be ABSENT, and that assertion is what makes this case
	# discriminating. `chmod 500` does not deny root, so a suite running as uid
	# 0 (a root Docker image or devcontainer — exactly what CI may be) takes the
	# LOCKED path instead, where `alive` and the report line are both satisfied
	# with the fallback branch broken. Reading a 0500 directory is still
	# permitted, so this listing works for either uid.
	# `if ... fi` rather than `[ ... ] && var=yes`: bats runs tests under
	# `set -e`, and a false `&&` compound would abort before the `kill` and the
	# `chmod 700`, leaking the background node process and leaving the tmpdir
	# unwritable for the rest of the run.
	local unlocked=no
	if [ -z "$(find "$rotmp" -mindepth 1 -print -quit)" ]; then unlocked=yes; fi
	local alive=no
	if kill -0 "$pid" 2>/dev/null; then alive=yes; fi
	kill "$pid" 2>/dev/null || true
	chmod 700 "$rotmp"

	[ "$unlocked" = yes ]
	[ "$alive" = yes ]
	grep -q "@x/thing has 1 ae-\*/tsdoc- issue in prod" "${BATS_TEST_TMPDIR}/out.log"
}

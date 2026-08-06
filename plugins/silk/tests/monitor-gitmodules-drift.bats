#!/usr/bin/env bats
# tests/monitor-gitmodules-drift.bats
#
# Coverage for monitors/gitmodules-drift.mjs: notifies only when
# `savvy repos status --drift --json` reports drift, naming each drift's
# kind. Silent on a clean report and silent (fail-open) when the savvy CLI
# is unavailable in the project. No network is ever touched -- these tests
# stub the CLI with a local fixture script.

load 'test_helper'

MONITOR="${PLUGIN_ROOT}/monitors/gitmodules-drift.mjs"

setup() {
	common_setup
	make_project >/dev/null
	force_npm_runner
}

# teardown -- reliably kill any background monitor a watch-mode test started,
# regardless of whether the test passed, failed, or timed out its own wait
# loop. MONITOR_PID is unset by default; only set by tests that background
# the monitor (the lazy .repos watch case below).
teardown() {
	if [ -n "${MONITOR_PID:-}" ]; then
		kill "$MONITOR_PID" 2>/dev/null || true
		wait "$MONITOR_PID" 2>/dev/null || true
	fi
}

# _stub_savvy <version_exit> <status_exit> <json_file> -- stub `npx` (the npm
# runner, this suite's stubbed token per force_npm_runner) with a savvy
# simulator: `--version` exits with <version_exit> (0 = CLI available), and
# `repos status --drift --json` prints the contents of <json_file> and exits
# with <status_exit> -- mirroring the real CLI's !clean/drift convention of
# a non-zero exit alongside parseable JSON on stdout.
_stub_savvy() {
	local ver="$1" status_exit="$2" json_file="$3"
	use_stub_bin
	write_stub npx <<STUB
#!/usr/bin/env bash
for a in "\$@"; do
	case "\$a" in
		--version) exit ${ver} ;;
	esac
done
cat "${json_file}"
exit ${status_exit}
STUB
}

write_json() {
	local dest="${BATS_TEST_TMPDIR}/${1}"
	cat > "$dest"
	echo "$dest"
}

@test "drift present: emits one line per drift, naming its kind" {
	local json
	json=$(write_json drift.json <<-'EOF'
	{"repos":[{"name":"effect","present":true,"dirty":false,"staleNoteIds":[]}],"clean":false,
	 "drift":{"drifts":[{"name":"effect","kind":"gitlink-mismatch","detail":"pinned ref differs from HEAD"}],"clean":false}}
	EOF
	)
	_stub_savvy 0 1 "$json"
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" SILK_PACKAGE_MANAGER="$SILK_PACKAGE_MANAGER" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *".repos drift: effect: gitlink-mismatch — pinned ref differs from HEAD"* ]]
}

@test "multiple drifts: one line per drift, each naming its own kind" {
	local json
	json=$(write_json drift.json <<-'EOF'
	{"repos":[],"clean":false,
	 "drift":{"drifts":[
	   {"name":"effect","kind":"gitlink-mismatch","detail":"pinned ref differs from HEAD"},
	   {"name":"other-repo","kind":"missing-gitmodules-entry","detail":"present in config.json but absent from .gitmodules"}
	 ],"clean":false}}
	EOF
	)
	_stub_savvy 0 1 "$json"
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" SILK_PACKAGE_MANAGER="$SILK_PACKAGE_MANAGER" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *".repos drift: effect: gitlink-mismatch"* ]]
	[[ "$output" == *".repos drift: other-repo: missing-gitmodules-entry"* ]]
}

@test "clean report (no drift): silent, no crash" {
	local json
	json=$(write_json clean.json <<-'EOF'
	{"repos":[],"clean":true,"drift":{"drifts":[],"clean":true}}
	EOF
	)
	_stub_savvy 0 0 "$json"
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" SILK_PACKAGE_MANAGER="$SILK_PACKAGE_MANAGER" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "savvy CLI unavailable (--version fails): silent, fail-open" {
	local json
	json=$(write_json unreachable.json <<-'EOF'
	{"repos":[],"clean":false,"drift":{"drifts":[{"name":"effect","kind":"gitlink-mismatch","detail":"should not be read"}],"clean":false}}
	EOF
	)
	_stub_savvy 1 1 "$json"
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" SILK_PACKAGE_MANAGER="$SILK_PACKAGE_MANAGER" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "no savvy on PATH at all: silent, fail-open" {
	# No use_stub_bin / write_stub: PATH keeps only real tools, and this
	# project's fixture tree has no savvy installed, so npx would fail to
	# resolve it. Guard against a real npx elsewhere in the test environment
	# by pointing PATH at nothing but core POSIX tools plus node's own dir.
	local node_dir
	node_dir=$(dirname "$(command -v node)")
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" SILK_PACKAGE_MANAGER="$SILK_PACKAGE_MANAGER" PATH="${node_dir}:/usr/bin:/bin" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

# --- watch mode: the lazy .repos/config.json watcher --------------------------
# .repos/ does not exist at monitor startup for a project with nothing
# vendored yet; main() falls back to watching the project root for the
# directory's own creation and only then establishes the config.json
# watcher (gitmodules-drift.mjs's watchFileIn fallback). --once bypasses all
# of main()'s watch setup, so this is the only case that actually exercises
# it.
#
# The dir-create handler ALSO fires an unconditional scheduled() of its own
# (so a drift check runs even the moment .repos/ appears, before any
# config.json watcher exists) -- a stub that returns fixed drift JSON
# regardless of content cannot tell that call apart from a later, properly
# observed config.json write, so a mutant that deletes the lazy watcher
# establishment but keeps that one unconditional call still passes such a
# test vacuously. The stub here is content-aware instead: it only reports
# drift once .repos/config.json contains a sentinel written in phase 2, so
# phase 1 (mkdir alone) must show NO notification and phase 2 (writing the
# sentinel) must show one -- discriminating the watcher itself, not just the
# directory-creation event.
@test "lazy .repos watch: only a properly established config.json watcher observes a later write" {
	local sentinel="LATE-DRIFT-SENTINEL"
	local config="${CLAUDE_PROJECT_DIR}/.repos/config.json"

	use_stub_bin
	write_stub npx <<STUB
#!/usr/bin/env bash
for a in "\$@"; do
	case "\$a" in
		--version) exit 0 ;;
	esac
done
if grep -q "${sentinel}" "${config}" 2>/dev/null; then
	printf '%s\n' '{"repos":[],"clean":false,"drift":{"drifts":[{"name":"late-repo","kind":"gitlink-mismatch","detail":"appeared after startup"}],"clean":false}}'
	exit 1
fi
printf '%s\n' '{"repos":[],"clean":true,"drift":{"drifts":[],"clean":true}}'
exit 0
STUB

	local out="${BATS_TEST_TMPDIR}/monitor.out"
	env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" SILK_PACKAGE_MANAGER="$SILK_PACKAGE_MANAGER" PATH="$PATH" \
		node "$MONITOR" > "$out" 2>&1 &
	MONITOR_PID=$!

	# Give the process time to start and establish its ROOT-level watcher
	# (there is no .repos/ yet, so only the ROOT watcher exists at this point)
	# before creating the directory it is waiting on.
	sleep 0.3
	mkdir -p "${CLAUDE_PROJECT_DIR}/.repos"

	# Phase 1: .repos/ now exists but config.json does not carry the sentinel
	# (it doesn't exist at all yet). The dir-create handler's own
	# unconditional scheduled() call still runs a drift check here -- the
	# stub reports clean without the sentinel, so this must produce no
	# output. Wait well past the >=500ms debounce window before asserting.
	sleep 1.5
	[ ! -s "$out" ]

	# Phase 2: write config.json WITH the sentinel. Only a watcher actually
	# established on .repos/config.json observes this write and re-fires
	# scheduled(); a mutant that drops the lazy establishment never re-checks,
	# so the sentinel is never seen and this phase's assertion fails under it.
	printf '%s\n' "${sentinel}" > "$config"

	local waited=0
	while [ "$waited" -lt 5000 ] && ! grep -q "late-repo" "$out" 2>/dev/null; do
		sleep 0.1
		waited=$((waited + 100))
	done

	kill "$MONITOR_PID" 2>/dev/null || true
	wait "$MONITOR_PID" 2>/dev/null || true
	unset MONITOR_PID

	grep -q "late-repo" "$out"
}

@test "malformed JSON on stdout: silent, no crash" {
	use_stub_bin
	write_stub npx <<-'STUB'
	#!/usr/bin/env bash
	for a in "$@"; do
		case "$a" in
			--version) exit 0 ;;
		esac
	done
	printf 'not json'
	exit 1
	STUB
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" SILK_PACKAGE_MANAGER="$SILK_PACKAGE_MANAGER" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

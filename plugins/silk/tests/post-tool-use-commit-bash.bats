#!/usr/bin/env bats
# tests/post-tool-use-commit-bash.bats
#
# Coverage for hooks/post-tool-use/commit-bash.sh: after a commit-shaped Bash
# command completes (and was NOT interrupted), pipe the envelope to
# `savvy commit hook post-commit-verify` and let its stdout flow through.
# Non-commit commands, interrupted runs, and empty commands exit 0 silently.
#
# This hook emits no wrapper JSON of its own — its only output is the CLI's.

load 'test_helper'

HOOK="${HOOKS_DIR}/post-tool-use/commit-bash.sh"

setup() {
	common_setup
}

_stub_ok_cli() {
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
printf 'CLI-POST-VERIFY-RAN\n'
exit 0
STUB
}

@test "committed (not interrupted): CLI post-verify stdout flows through" {
	_stub_ok_cli
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.bash-commit.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[[ "$output" == *"CLI-POST-VERIFY-RAN"* ]]
}

@test "interrupted commit: silent no-op (CLI not invoked)" {
	_stub_ok_cli
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.bash-interrupted.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "non-commit command (ls -la): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.bash-unrelated.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "empty command: silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.bash-empty.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "failing CLI: fails open (exit 0, error logged)" {
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
echo 'verify exploded' >&2
exit 1
STUB
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.bash-commit.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[ -f "$SILK_HOOK_ERROR_LOG" ]
	grep -q "post-commit-verify failed" "$SILK_HOOK_ERROR_LOG"
}

@test "malformed JSON input: non-zero exit (jq parse error)" {
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -ne 0 ]
	[ -z "$output" ]
}

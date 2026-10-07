#!/usr/bin/env bats
# __test__/post-tool-use-commit-bash.bats
#
# Coverage for hooks/post-tool-use/commit-bash.sh: after a commit-shaped Bash
# command completes (and was NOT interrupted), pipe the envelope to
# `savvy commit hook post-commit-verify` and let its stdout flow through.
# Non-commit commands, interrupted runs, and empty commands exit 0 silently.
#
# This hook emits no wrapper JSON of its own — its only output is the CLI's.

load common

HOOK="hooks/post-tool-use/commit-bash.sh"

silk_file_setup() {
	common_setup
}

_stub_ok_cli() {
	make_repo_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"CLI-POST-VERIFY-RAN"}}'
exit 0
STUB
}

@test "committed (not interrupted): CLI post-verify advice is relayed as context" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_ok_cli
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.bash-commit.json"
	[ "$status" -eq 0 ]
	expect_context_contains "CLI-POST-VERIFY-RAN"
	done
}

@test "interrupted commit: silent no-op (CLI not invoked)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_ok_cli
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.bash-interrupted.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "non-commit command (ls -la): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.bash-unrelated.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "empty command: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.bash-empty.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "failing CLI: fails open (exit 0, error logged)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
echo 'verify exploded' >&2
exit 1
STUB
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.bash-commit.json"
	assert_hook_noop
	[ -f "$SILK_ERROR_LOG" ]
	grep -q "post-commit-verify failed" "$SILK_ERROR_LOG"
	done
}

@test "malformed JSON input: no-op (fails open)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run_stdin "$HOOK" 'not json'
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

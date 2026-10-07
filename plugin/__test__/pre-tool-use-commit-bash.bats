#!/usr/bin/env bats
# __test__/pre-tool-use-commit-bash.bats
#
# Coverage for hooks/pre-tool-use/commit-bash.sh:
#   - Hot path: a command matching the safe-bash allow-list is auto-allowed.
#   - Cold path: a commit-shaped command (git commit / gh pr create|edit) is
#     piped to `savvy commit hook pre-commit-message` and the CLI's stdout
#     flows straight through as the decision. CLI failures fail open (exit 0).
#   - Everything else exits 0 silently.
#
# The cold-path tests pin the runner to npm and stub `npx` so no real savvy
# CLI is invoked. See test_helper.bash (use_stub_bin / force_npm_runner).

load common

HOOK="hooks/pre-tool-use/commit-bash.sh"

silk_file_setup() {
	common_setup
}

@test "safe command (git status): auto-allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.bash-safe.json"
	[ "$status" -eq 0 ]
	[ "$(jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision)' <<< "$output")" = "allow" ]
	# hook_allow carries the plugins/silk reason again (pluginfinity 0.3.0).
	[[ "$(_reason)" == "auto-allowed safe Bash: "* ]]
	done
}

@test "unrelated, non-safe, non-commit command: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.bash-unrelated.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "empty command: silent exit 0" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.bash-empty.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "git commit: routes to cold path, the CLI's deny is relayed in the host's shape" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >"${SILK_STDIN_CAPTURE}"
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"CLI-PRE-COMMIT-RAN"}}'
exit 0
STUB
	export SILK_STDIN_CAPTURE="${SILK_TMP}/cli-stdin.json"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.bash-commit.json"
	[ "$status" -eq 0 ]
	[ "$(_decision)" = "deny" ]
	[ "$(_reason)" = "CLI-PRE-COMMIT-RAN" ]
	# The CLI decodes Claude Code's envelope on both hosts.
	[ "$(jq -r .hook_event_name "$SILK_STDIN_CAPTURE")" = "PreToolUse" ]
	[ "$(jq -r .tool_name "$SILK_STDIN_CAPTURE")" = "Bash" ]
	[[ "$(jq -r .tool_input.command "$SILK_STDIN_CAPTURE")" == *"git commit"* ]]
	done
}

@test "git commit with a failing CLI: fails open (exit 0, error logged)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
echo 'cli exploded' >&2
exit 1
STUB
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.bash-commit.json"
	assert_hook_noop
	[ -f "$SILK_ERROR_LOG" ]
	grep -q "pre-commit-message failed" "$SILK_ERROR_LOG"
	done
}

@test "git commit: the CLI's advice is context on Claude Code and a no-op on Copilot" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"CLI-ADVICE"}}'
STUB
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.bash-commit.json"
	[ "$status" -eq 0 ]
	expect_context_contains "CLI-ADVICE"
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

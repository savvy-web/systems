#!/usr/bin/env bats
# tests/pre-tool-use-commit-bash.bats
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

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/commit-bash.sh"

setup() {
	common_setup
}

@test "safe command (git status): auto-allow" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.bash-safe.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.permissionDecision' <<< "$output")" = "allow" ]
	[[ "$output" == *"auto-allowed safe Bash"* ]]
}

@test "unrelated, non-safe, non-commit command: silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.bash-unrelated.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "empty command: silent exit 0" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.bash-empty.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "git commit: routes to cold path, CLI stdout flows through" {
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
printf 'CLI-PRE-COMMIT-RAN\n'
exit 0
STUB
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.bash-commit.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[[ "$output" == *"CLI-PRE-COMMIT-RAN"* ]]
}

@test "git commit with a failing CLI: fails open (exit 0, error logged)" {
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
echo 'cli exploded' >&2
exit 1
STUB
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.bash-commit.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[ -f "$SILK_HOOK_ERROR_LOG" ]
	grep -q "pre-commit-message failed" "$SILK_HOOK_ERROR_LOG"
}

@test "malformed JSON input: non-zero exit (jq parse error)" {
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -ne 0 ]
	[ -z "$output" ]
}

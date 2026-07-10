#!/usr/bin/env bats
# tests/pre-tool-use-changeset-push-guard.bats
#
# Coverage for hooks/pre-tool-use/changeset-push-guard.sh: block `git push`
# from a feature branch whose diff against the default branch carries no
# changeset. Fails open on anything ambiguous (non-push command, not a git
# repo, protected/exempt branch, override set).
#
# Each test builds an isolated git repo via init_push_repo (main + feature),
# then layers scenario-specific commits on top.

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/changeset-push-guard.sh"

setup() {
	common_setup
}

# Build a push envelope whose command is $1, echo its path.
_push_env() {
	local env="${BATS_TEST_TMPDIR}/push-env-${BATS_TEST_NUMBER}.json"
	jq --arg c "$1" '.tool_input.command = $c' \
		"${FIXTURES_DIR}/pretooluse.push-guard.json" > "$env"
	echo "$env"
}

_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

@test "non-push command: silent no-op" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_push_env "ls -la")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "feature branch, no changeset: deny with actionable reason" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_push_env "git push")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason
	reason="$(jq -r '.hookSpecificOutput.permissionDecisionReason' <<< "$output")"
	[[ "$reason" == *"Push blocked"* ]]
	[[ "$reason" == *"SILK_SKIP_PUSH_CHECK=1"* ]]
}

@test "feature branch WITH an added changeset: no-op" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	repo_commit "$CLAUDE_PROJECT_DIR" "docs: changeset" .changeset/tidy-mice.md "---"
	run bash -c "cat '$(_push_env "git push")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "inline SILK_SKIP_PUSH_CHECK=1 override: no-op even without a changeset" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_push_env "SILK_SKIP_PUSH_CHECK=1 git push")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "session-level SILK_SKIP_PUSH_CHECK=1 override: no-op even without a changeset" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	export SILK_SKIP_PUSH_CHECK=1
	run bash -c "cat '$(_push_env "git push")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "on the default branch (main): no-op" {
	init_push_repo >/dev/null
	git -C "$CLAUDE_PROJECT_DIR" checkout -q main
	run bash -c "cat '$(_push_env "git push")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "on a release/* branch: no-op (exempt branch prefix)" {
	init_push_repo >/dev/null
	git -C "$CLAUDE_PROJECT_DIR" checkout -q -b release/1.2.0
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_push_env "git push")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "git push --tags (no branch refspec): no-op (tags-only exemption)" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_push_env "git push --tags")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "git push origin main --tags (branch ref present): deny (not exempt)" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_push_env "git push origin main --tags")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "git push --delete origin foo: no-op (deletion exemption)" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_push_env "git push --delete origin foo")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "empty command: silent no-op" {
	init_push_repo >/dev/null
	run bash -c "cat '$(_push_env "")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "not a git repository: no-op (fails open)" {
	make_project >/dev/null
	run bash -c "cat '$(_push_env "git push")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "malformed JSON input: non-zero exit (jq parse error)" {
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -ne 0 ]
	[ -z "$output" ]
}

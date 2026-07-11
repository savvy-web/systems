#!/usr/bin/env bats
# tests/stop-changeset-nudge.bats
#
# Coverage for hooks/stop/changeset-nudge.sh — the NON-BLOCKING replacement for
# the old changeset push guard (savvy-web/systems#274).
#
# The contract, and the point of most of these tests:
#   * It emits a top-level `systemMessage` (shown to the human) and NOTHING else.
#   * It NEVER emits `decision`, and never `hookSpecificOutput.additionalContext`
#     — it does not block the stop and does not talk to the model.
#   * It is debounced on HEAD, so it speaks once per commit state rather than on
#     every main-agent turn.

load 'test_helper'

HOOK="${HOOKS_DIR}/stop/changeset-nudge.sh"

setup() {
	common_setup
}

# _stop_env [cwd] — build a Stop envelope, echo its path.
_stop_env() {
	local cwd="${1:-${CLAUDE_PROJECT_DIR:-}}"
	local env="${BATS_TEST_TMPDIR}/stop-env-${BATS_TEST_NUMBER}.json"
	jq --arg d "$cwd" '.cwd = $d' \
		"${FIXTURES_DIR}/stop.changeset-nudge.json" > "$env"
	echo "$env"
}

_message() {
	jq -r '.systemMessage // empty' <<< "$1"
}

# --- the core contract ------------------------------------------------------

@test "commits, no changeset: emits a systemMessage naming the branch" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	local msg
	msg="$(_message "$output")"
	[[ "$msg" == *"feature"* ]]
	[[ "$msg" == *"1 commit"* ]]
	[[ "$msg" == *"no changeset"* ]]
}

# The whole reason this hook replaced the push guard: it must not be able to
# block, deny, or force the agent to keep working.
@test "never blocks: no decision, no additionalContext, ever" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.decision // "none"' <<< "$output")" = "none" ]
	[ "$(jq -r '.continue // "unset"' <<< "$output")" = "unset" ]
	[ "$(jq -r '.hookSpecificOutput.additionalContext // "none"' <<< "$output")" = "none" ]
	# systemMessage is the ONLY key.
	[ "$(jq -r 'keys | join(",")' <<< "$output")" = "systemMessage" ]
}

@test "commits WITH a changeset: silent" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	repo_commit "$CLAUDE_PROJECT_DIR" "docs: changeset" .changeset/tidy-mice.md "---"
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "no commits since base: silent" {
	init_push_repo >/dev/null
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "on the default branch (main): silent" {
	init_push_repo >/dev/null
	git -C "$CLAUDE_PROJECT_DIR" checkout -q main
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "on a release/* branch: silent (exempt prefix)" {
	init_push_repo >/dev/null
	git -C "$CLAUDE_PROJECT_DIR" checkout -q -b release/1.2.0
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

# --- debounce: speak once per commit state, not once per turn ----------------

@test "debounce: second turn at the same HEAD is silent" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts

	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ -n "$(_message "$output")" ]

	# Same HEAD, next turn — must not nag again.
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "debounce: a NEW commit re-arms the nudge" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts

	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ -n "$(_message "$output")" ]
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$output" = "{}" ]

	# HEAD moves -> speak again, with the updated count.
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: more work" src/b.ts
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	local msg
	msg="$(_message "$output")"
	[[ "$msg" == *"2 commits"* ]]
}

# --- worktrees (the savvy-web/systems#274 resolution bug) --------------------

@test "worktree: reports the worktree's branch, not the primary checkout's" {
	local repo wt
	repo="$(init_push_repo)"
	export CLAUDE_PROJECT_DIR="$repo"
	repo_commit "$repo" "docs: changeset" .changeset/primary-note.md "---"

	wt="$(add_worktree "$repo" worktree-agent-9)"
	repo_commit "$wt" "feat: agent work" src/agent.ts

	run bash -c "cat '$(_stop_env "$wt")' | '${HOOK}'"
	[ "$status" -eq 0 ]
	local msg
	msg="$(_message "$output")"
	[[ "$msg" == *"worktree-agent-9"* ]]
	[[ "$msg" != *"'feature'"* ]]
}

# --- fail-open / opt-out ----------------------------------------------------

@test "opt-out via SILK_SKIP_CHANGESET_NUDGE: silent" {
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	export SILK_SKIP_CHANGESET_NUDGE=1
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "not a git repository: silent (fails open)" {
	make_project >/dev/null
	run bash -c "cat '$(_stop_env)' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "malformed JSON input: no-op (fails open)" {
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

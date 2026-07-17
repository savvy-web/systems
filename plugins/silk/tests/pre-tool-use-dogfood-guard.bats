#!/usr/bin/env bats
# tests/pre-tool-use-dogfood-guard.bats
#
# Coverage for hooks/pre-tool-use/dogfood-guard.sh: deny `git push` /
# `gh pr create|edit` (Bash), the GitKraken MCP equivalents (`git_push`,
# `pull_request_create`), and the GitHub MCP server's `create_pull_request` /
# `update_pull_request` / `push_files` whenever ANY ".claude/dogfood/*.jsonl"
# journal's last VALID line has role:"downstream" and phase != "unlinked".
# This is a TRIPWIRE, not a security boundary -- see the header comment in
# dogfood-guard.sh. Deny-path fixture pattern copied from
# pre-tool-use-repos-bash-guard.bats -- see tests/README.md "Deny-path
# fixture pattern".

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/dogfood-guard.sh"

setup() {
	common_setup
}

_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

_reason() {
	jq -r '.hookSpecificOutput.permissionDecisionReason // empty' <<< "$1"
}

# write_journal <project> <loop-id> <role> <phase> [round] -- append one
# snapshot line to .claude/dogfood/<loop-id>.jsonl, minimal shape (only the
# fields this hook reads plus enough to look like a real snapshot).
write_journal() {
	local project="$1" loop_id="$2" role="$3" phase="$4" round="${5:-1}"
	local dir="${project}/.claude/dogfood"
	mkdir -p "$dir"
	jq -nc --arg role "$role" --arg phase "$phase" --argjson round "$round" \
		'{at: "2026-07-16T00:00:00Z", event: "phase-change", role: $role, phase: $phase, ball: "ours", round: $round}' \
		>> "${dir}/${loop_id}.jsonl"
}

# append_raw <project> <loop-id> <raw-line> -- append a literal line (used to
# construct corrupt-tail / empty-file scenarios that write_journal's jq
# construction can't express).
append_raw() {
	local project="$1" loop_id="$2" raw="$3"
	local dir="${project}/.claude/dogfood"
	mkdir -p "$dir"
	printf '%s\n' "$raw" >> "${dir}/${loop_id}.jsonl"
}

@test "no .claude/dogfood directory: silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "dogfood dir present but no *.jsonl journals: silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	mkdir -p "${project}/.claude/dogfood"
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "unrelated Bash command (git status): silent no-op even with an active downstream loop" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.bash-safe.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "unrelated MCP op (git_status): silent no-op even with an active downstream loop" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gitkraken-read.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "'push' appears only inside a commit message, not as the git subcommand: silent no-op" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-push-mention-only.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "non-Bash, non-MCP tool_name: silent no-op" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-empty.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "malformed JSON input: no-op (fails open)" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "printf 'not json' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "downstream + requested: git push denied, naming loop id, phase, and --exit" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream requested
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"effected"* ]]
	[[ "$reason" == *"requested"* ]]
	[[ "$reason" == *"/silk:dogfood --exit"* ]]
}

@test "downstream + implementing: git push (with global flag + force) denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream implementing
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-flags.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + handoff: gh pr create denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream handoff
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-gh-pr-create.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + adopting: gh pr edit denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-gh-pr-edit.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + findings: MCP git_push denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream findings
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gitkraken-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + upstream-pr: MCP pull_request_create denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream upstream-pr
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-pull-request-create.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + handoff: GitHub MCP create_pull_request denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream handoff
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-create-pull-request.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + adopting: scoped GitHub MCP update_pull_request denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-update-pull-request.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + findings: GitHub MCP push_files denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream findings
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-push-files.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + unlinked (terminal): GitHub MCP create_pull_request silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-create-pull-request.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "no active dogfood loop: GitHub MCP push_files silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-push-files.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "downstream + released: git push denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream released
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "downstream + unlinked (terminal): silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "upstream role, any active phase: silent allow (upstream is not push-guarded)" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected upstream upstream-pr
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "multiple journals, only the second is an active downstream loop: denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" clean-upstream upstream implementing
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"effected"* ]]
}

@test "corrupt tail line walks back to the previous valid (still-active) snapshot: denied" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	append_raw "$project" effected '{"at": "2026-07-16T01:00:00Z", "event": "mail-sent"'  # truncated / malformed
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "corrupt tail line walks back to a now-unlinked snapshot: silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	append_raw "$project" effected 'not even json'
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "journal with no valid line at all: allow (fail-open), warning logged" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	append_raw "$project" effected 'not json at all'
	append_raw "$project" effected '{"broken": '
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	run cat "$SILK_HOOK_ERROR_LOG"
	[[ "$output" == *"no valid JSONL line"* ]]
}

@test "empty journal file: allow (fail-open), no crash" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	mkdir -p "${project}/.claude/dogfood"
	: > "${project}/.claude/dogfood/effected.jsonl"
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

#!/usr/bin/env bats
# tests/pre-tool-use-biome-prefer-mcp.bats
#
# Coverage for hooks/pre-tool-use/biome-prefer-mcp.sh:
#
# - The subagent guard added for savvy-web/systems#247: a dispatched
#   subagent only has mcp__plugin_silk_savvy-mcp__biome_check if its own
#   tools: allowlist names it. When the envelope carries agent_id (present
#   only inside a subagent call), the hook must stay silent rather than
#   nudge the subagent toward a tool it structurally cannot call.
# - The command-position direct-match matcher added for
#   savvy-web/systems#248: "biome" appearing as a later argument or inside
#   a quoted string (e.g. a `gh issue create --body "... biome ..."`) must
#   NOT trigger the nudge; only an actual invocation in command position
#   (directly, after a runner keyword, or after a chained-command operator)
#   should.

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/biome-prefer-mcp.sh"

setup() {
	common_setup
}

@test "subagent envelope (agent_id present) + direct biome command: no nudge" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.biome-bash-subagent.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "main-session envelope (no agent_id) + direct biome command: nudge emitted" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.biome-bash-direct.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "PreToolUse" ]
	[ "$(jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$output")" = "" ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"mcp__plugin_silk_savvy-mcp__biome_check"* ]]
}

@test "main-session envelope, grep command that only mentions 'biome' as a quoted regex string: no nudge (false-positive check)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.biome-grep-mention.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "main-session envelope, unrelated command: no nudge" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.non-bash-unrelated.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "a subagent's biome call does not consume the main thread's one-time nudge marker" {
	# Same session_id for both calls: first from a subagent (agent_id set),
	# then from the main thread (agent_id absent). The subagent call must
	# short-circuit before the once-per-session marker file is written, so
	# the main-thread call still gets nudged afterward.
	local session="shared-session-marker-check"
	local sub_fixture="${BATS_TEST_TMPDIR}/sub-envelope.json"
	local main_fixture="${BATS_TEST_TMPDIR}/main-envelope.json"

	jq --arg sid "$session" '.session_id = $sid' "${FIXTURES_DIR}/pretooluse.biome-bash-subagent.json" > "$sub_fixture"
	jq --arg sid "$session" '.session_id = $sid' "${FIXTURES_DIR}/pretooluse.biome-bash-direct.json" > "$main_fixture"

	run bash -c "cat '${sub_fixture}' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]

	run bash -c "cat '${main_fixture}' | '${HOOK}'"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"mcp__plugin_silk_savvy-mcp__biome_check"* ]]
}

@test "nudge fires at most once per session for the main thread" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.biome-bash-direct.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[[ "$(jq -r '.hookSpecificOutput.additionalContext // empty' <<< "$output")" == *"biome_check"* ]]

	# Second call, same session_id (same fixture) -> already-nudged marker
	# exists -> no-op.
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.biome-bash-direct.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

# --- savvy-web/systems#248: command-position matcher --------------------

@test "gh issue create --body mentioning 'biome' in prose: no nudge (#248 repro)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.gh-issue-body-mentions-biome.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "grep biome somefile: no nudge (biome is an argument, not the invoked binary)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.grep-biome-argument.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "biome check .: nudge emitted (still matches — regression guard)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.biome-bash-direct.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[[ "$(jq -r '.hookSpecificOutput.additionalContext // empty' <<< "$output")" == *"biome_check"* ]]
}

@test "pnpm exec biome check: nudge emitted (still matches — regression guard)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.pnpm-exec-biome.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[[ "$(jq -r '.hookSpecificOutput.additionalContext // empty' <<< "$output")" == *"biome_check"* ]]
}

@test "absolute-path biome invocation: nudge emitted (still matches — regression guard)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.absolute-path-biome.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[[ "$(jq -r '.hookSpecificOutput.additionalContext // empty' <<< "$output")" == *"biome_check"* ]]
}

@test "cd foo && biome check .: nudge emitted (chained command, still matches — regression guard)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.chained-cd-biome.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[[ "$(jq -r '.hookSpecificOutput.additionalContext // empty' <<< "$output")" == *"biome_check"* ]]
}

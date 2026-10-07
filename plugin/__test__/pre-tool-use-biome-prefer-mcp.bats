#!/usr/bin/env bats
# __test__/pre-tool-use-biome-prefer-mcp.bats
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

load common

HOOK="hooks/pre-tool-use/biome-prefer-mcp.sh"

silk_file_setup() {
	common_setup
}

@test "subagent envelope (agent_id present) + direct biome command: no nudge" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.biome-bash-subagent.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "main-session envelope (no agent_id) + direct biome command: nudge emitted" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.biome-bash-direct.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	expect_event_name PreToolUse
	[ "$(jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision) // empty' <<< "$output")" = "" ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	[[ "$ctx" == *"mcp__plugin_silk_savvy-mcp__biome_check"* ]]
	done
}

@test "main-session envelope, grep command that only mentions 'biome' as a quoted regex string: no nudge (false-positive check)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.biome-grep-mention.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "main-session envelope, unrelated command: no nudge" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.non-bash-unrelated.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "a subagent's biome call does not consume the main thread's one-time nudge marker" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	# Same session_id for both calls: first from a subagent (agent_id set),
	# then from the main thread (agent_id absent). The subagent call must
	# short-circuit before the once-per-session marker file is written, so
	# the main-thread call still gets nudged afterward.
	local session="shared-session-marker-check"
	local sub_fixture="${SILK_TMP}/sub-envelope.json"
	local main_fixture="${SILK_TMP}/main-envelope.json"

	jq --arg sid "$session" '.session_id = $sid' "${FIXTURES_DIR}/pretooluse.biome-bash-subagent.json" > "$sub_fixture"
	jq --arg sid "$session" '.session_id = $sid' "${FIXTURES_DIR}/pretooluse.biome-bash-direct.json" > "$main_fixture"

	silk_run "$HOOK" "${sub_fixture}"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]

	silk_run "$HOOK" "${main_fixture}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	[[ "$ctx" == *"mcp__plugin_silk_savvy-mcp__biome_check"* ]]
	done
}

@test "nudge fires at most once per session for the main thread" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.biome-bash-direct.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]

	# Second call, same session_id (same fixture) -> already-nudged marker
	# exists -> no-op.
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.biome-bash-direct.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

# --- savvy-web/systems#248: command-position matcher --------------------

@test "gh issue create --body mentioning 'biome' in prose: no nudge (#248 repro)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.gh-issue-body-mentions-biome.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "grep biome somefile: no nudge (biome is an argument, not the invoked binary)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.grep-biome-argument.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "biome check .: nudge emitted (still matches — regression guard)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.biome-bash-direct.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

@test "pnpm exec biome check: nudge emitted (still matches — regression guard)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.pnpm-exec-biome.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

@test "absolute-path biome invocation: nudge emitted (still matches — regression guard)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.absolute-path-biome.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

@test "cd foo && biome check .: nudge emitted (chained command, still matches — regression guard)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.chained-cd-biome.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

# --- savvy-web/systems#250: env / VAR= / runner-peeling coverage --------
#
# _biome_segment_invokes_biome's peeling loop (env, inline VAR=value, and
# pnpm|npm|yarn|bun optionally-followed-by-run) was the least-obviously-
# correct part of the matcher and had no dedicated tests before this PR.

@test "env biome check .: nudge emitted (leading 'env' is peeled)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.biome-env-direct.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

@test "FOO=bar biome check .: nudge emitted (inline VAR=value assignment is peeled)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.biome-inline-assignment.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

# npm run biome / pnpm run biome / yarn biome: the matcher's docstring
# explicitly documents peeling "pnpm/npm/yarn/bun optionally followed by
# run" as one of the accepted runner-keyword forms (see the "1. Direct
# invocation" comment above), so a script literally NAMED "biome" is
# intentionally treated as a direct match here -- this is distinct from,
# and does not disturb, branch 2 below (which inspects the package.json
# script BODY for scripts not literally named "biome").
#
# Nuance worth flagging rather than silently cementing: `npm run biome`
# runs a package.json script named "biome", not the biome binary directly.
# In the common convention (`"biome": "biome check --write ."`) that
# script's body does invoke the real biome binary, so nudging is the
# right call in the overwhelmingly likely case. But nothing here confirms
# the script body actually shells out to biome -- a script named "biome"
# that does something unrelated would still nudge. This asserts the
# matcher's actual (documented) intent; if a false-positive on a
# non-biome "biome"-named script ever surfaces in practice, that's a
# follow-up worth its own decision, not something to silently "fix" here.
@test "npm run biome: nudge emitted (script literally named 'biome' -- documented runner-keyword peel, see comment above)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.npm-run-biome.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

@test "pnpm run biome: nudge emitted (same runner-keyword peel as npm run biome)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.pnpm-run-biome.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

@test "yarn biome (no 'run' keyword): nudge emitted (bare 'pnpm|npm|yarn|bun <script>' form is also peeled)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.yarn-biome-no-run.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"biome_check"* ]]
	done
}

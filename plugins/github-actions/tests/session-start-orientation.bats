#!/usr/bin/env bats
# tests/session-start-orientation.bats
#
# Coverage for hooks/session-start/orientation.sh: on every session start,
# emit SessionStart additionalContext with the <github_actions_plugin> surface
# (the action-engineer agent, the full skill index, and the savvy-mcp
# pointer), fail open when jq is missing, and tolerate arbitrary stdin (the
# hook drains the envelope without parsing it).

load 'test_helper'

HOOK="${HOOKS_DIR}/session-start/orientation.sh"

setup() {
	common_setup
}

@test "emits SessionStart context with the orientation payload" {
	run bash -c "printf '{}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"github_actions_plugin"* ]]
	[[ "$ctx" == *"action-engineer"* ]]
	[[ "$ctx" == *"workspace_info"* ]]
	[[ "$ctx" == *"github-action-effects"* ]]
	[[ "$ctx" == *"github-action-builder"* ]]
	[[ "$ctx" == *"dogfood_feedback"* ]]
}

@test "additionalContext names every skill on disk" {
	run bash -c "printf '{}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	local found=0
	for skill in "${PLUGIN_ROOT}"/skills/*/; do
		local name
		name="$(basename "$skill")"
		[[ "$ctx" == *"- ${name} "* ]] || {
			echo "skill '${name}' exists on disk but is not named in the orientation payload" >&2
			return 1
		}
		found=$((found + 1))
	done
	# Guard against an empty skills/ glob silently passing the loop above.
	[ "$found" -ge 12 ] || {
		echo "expected at least 12 skills on disk, found ${found}" >&2
		return 1
	}
}

@test "fails open with an empty response when jq is missing" {
	# A restricted PATH carrying everything the hook needs except jq.
	local stub="${BATS_TEST_TMPDIR}/nojq-bin"
	mkdir -p "$stub"
	local tool
	for tool in bash cat date mkdir dirname grep; do
		ln -s "$(command -v "$tool")" "${stub}/${tool}"
	done
	run env PATH="$stub" HOME="$HOME" CLAUDE_PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT" \
		GITHUB_ACTIONS_HOOK_ERROR_LOG="$GITHUB_ACTIONS_HOOK_ERROR_LOG" \
		bash -c "printf '{}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "tolerates malformed stdin (envelope is drained, not parsed)" {
	run bash -c "printf 'not json at all' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
}

@test "tolerates empty stdin" {
	run bash -c "printf '' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
}

#!/usr/bin/env bats
# agent-skill-registration.bats — pins WHERE each skill is registered in the
# action-engineer agent's YAML frontmatter, not merely that the name appears
# somewhere in the file.
#
# A presence check cannot catch a key in the wrong array: a skill listed under
# `tools:` instead of `skills:` would satisfy a bare grep while never being
# preloaded by the agent. These tests extract the `skills:` block specifically
# and search only inside it.

PLUGIN_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
AGENTS="$PLUGIN_ROOT/agents"
AGENT_NAMES=(action-engineer)

# _skills_block agent_file — prints the list items under the top-level
# `skills:` key, stopping at the next top-level key. Anything under `tools:`
# (or any other key) is excluded by construction.
_skills_block() {
	awk '
		/^skills:[[:space:]]*$/ { inblock = 1; next }
		/^[A-Za-z_-]+:/         { inblock = 0 }
		inblock && /^[[:space:]]*-[[:space:]]+/ {
			sub(/^[[:space:]]*-[[:space:]]+/, "")
			print
		}
	' "$1"
}

# _tools_block agent_file — same, for the `tools:` key.
_tools_block() {
	awk '
		/^tools:[[:space:]]*$/ { inblock = 1; next }
		/^[A-Za-z_-]+:/        { inblock = 0 }
		inblock && /^[[:space:]]*-[[:space:]]+/ {
			sub(/^[[:space:]]*-[[:space:]]+/, "")
			print
		}
	' "$1"
}

@test "every agent declares a non-empty skills block" {
	for agent in "${AGENT_NAMES[@]}"; do
		run _skills_block "$AGENTS/$agent.md"
		[ "$status" -eq 0 ]
		[ -n "$output" ] || {
			echo "agent $agent has an empty or missing skills: block" >&2
			return 1
		}
	done
}

@test "every skill on disk is registered under skills: in every agent" {
	local count=0
	for agent in "${AGENT_NAMES[@]}"; do
		for skill in "$PLUGIN_ROOT"/skills/*/; do
			name="$(basename "$skill")"
			_skills_block "$AGENTS/$agent.md" | grep -qx -- "$name" || {
				echo "agent $agent does not list skill '$name' under skills:" >&2
				return 1
			}
			count=$((count + 1))
		done
	done
	# Guard against an empty skills/ glob silently passing the loop above.
	[ "$count" -ge 12 ] || {
		echo "expected at least 12 skills on disk, found ${count}" >&2
		return 1
	}
}

@test "no skill name leaks into an agent's tools block" {
	# A skill in tools: is the exact bug this file exists to catch — it would
	# still satisfy any test that merely greps the file for the skill name.
	for agent in "${AGENT_NAMES[@]}"; do
		for skill in "$PLUGIN_ROOT"/skills/*/; do
			name="$(basename "$skill")"
			if _tools_block "$AGENTS/$agent.md" | grep -qx -- "$name"; then
				echo "agent $agent lists the SKILL '$name' under tools:" >&2
				return 1
			fi
		done
	done
}

@test "every skill an agent names actually exists on disk" {
	for agent in "${AGENT_NAMES[@]}"; do
		while IFS= read -r name; do
			[ -f "$PLUGIN_ROOT/skills/$name/SKILL.md" ] || {
				echo "agent $agent names skill '$name', which has no SKILL.md" >&2
				return 1
			}
		done < <(_skills_block "$AGENTS/$agent.md")
	done
}

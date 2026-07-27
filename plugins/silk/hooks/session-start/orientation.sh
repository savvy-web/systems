#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook (no matcher — fires on all starts including resume/compact):
# persist namespaced SILK_* env vars and inject the silk capability surface into
# every session.
#
# Merges: changeset-env-export.sh + mcp-orientation.sh
#
# Contract: reads SessionStart envelope on stdin, writes 5 SILK_* exports to
# the per-session silk-hook.sh file and CLAUDE_ENV_FILE, then emits
# additionalContext with a single <silk_capabilities> block: compact indexes of
# the savvy-mcp tools, agents and skills, a one-line Biome division of labor,
# and a prose active-hooks note. The block is deliberately index-shaped —
# parameter/mode detail lives on each tool's schema, skill detail in each
# skill's frontmatter description, and edit-time conventions in startup-only.sh
# (context-engineering trim, 2026-07: duplicated or on-demand-loadable detail
# does not belong in an always-on payload that re-fires on resume/compact).

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="session-start-orientation"

# Fail open without jq.
if ! command -v jq &>/dev/null; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"
hook_json="$HOOK_ENVELOPE"
session_id=$(jq -r '.session_id // ""' <<< "$hook_json")

# Working-tree resolution (savvy-web/systems#274): the envelope's cwd outranks
# CLAUDE_PROJECT_DIR, which is pinned to the PRIMARY checkout for the whole
# session and does not follow a git worktree. This hook is the producer of
# SILK_PROJECT_DIR, so what it resolves here is what every reader hook sees.
project_dir=$(resolve_project_dir "$hook_json")
data_dir="${CLAUDE_PLUGIN_DATA:-}"
plugin_root="${CLAUDE_PLUGIN_ROOT:-}"

# Package-manager detection is shared with startup-only.sh via hook-env.sh —
# it fails open to npm. Reader hooks pick it up through SILK_PACKAGE_MANAGER.
package_manager=$(detect_package_manager "$project_dir")

# it2 pane-orchestration gate (savvy-web/systems, 2026-07-21 design): env +
# `command -v it2` ONLY — no it2 subprocess here. This hook fires on every
# resume/compact, and invoking it2 risks its first-use iTerm2 API-authorization
# dialog or a hang. TERMINAL_BLOCK stays empty unless BOTH the terminal program
# is iTerm2 (TERM_PROGRAM or the locale-derived LC_TERMINAL) AND the it2 CLI is
# actually on PATH; either check failing means no block, no cost.
TERMINAL_BLOCK=""
if { [ "${TERM_PROGRAM:-}" = "iTerm.app" ] || [ "${LC_TERMINAL:-}" = "iTerm2" ]; } \
	&& command -v it2 &>/dev/null; then
	# No apostrophes in this body: bash <4 (still /bin/bash on a stock macOS
	# install) misparses a single-quote heredoc nested inside a command
	# substitution when the body carries an odd number of `'` characters,
	# swallowing the real terminator and failing the whole script with
	# "unexpected EOF while looking for matching `''" (verified locally against
	# /bin/bash 3.2.57). Contraction-free wording sidesteps the bug outright
	# instead of depending on an accidental even count.
	terminal_body=$(cat <<'TERMINAL'
<terminal>
You are in iTerm2 with it2 available: you can drive terminal panes and windows
directly, not just the shell you were spawned in. Proactively orchestrate for
subagents you spawn: split a pane per subagent, badge it with a session-id
prefix, and manage windows for the user, keeping the layout legible without
rearranging beyond what the work needs. Match split direction and grid shape
to the window geometry; see /silk:it2 for the rules.

Dismiss subagents you no longer need to retask (shut them down instead of
leaving them idle) and close their it2 pane when you do; never leave an idle
agent or an orphaned pane behind. /silk:it2 has the full layout playbook and
commands.
</terminal>
TERMINAL
)
	# Deliberate string concatenation (not command substitution) so the leading
	# and trailing blank-line padding survives — command substitution strips
	# trailing newlines, which would collapse the spacing around the block
	# inside the CONTEXT heredoc below.
	TERMINAL_BLOCK=$'\n'"${terminal_body}"$'\n'
fi

if [ -n "$session_id" ]; then
	env_dir="${HOME}/.claude/session-env/${session_id}"
	mkdir -p "$env_dir"
	hook_env_file="${env_dir}/silk-hook.sh"

	{
		printf 'export SILK_PROJECT_DIR=%q\n' "$project_dir"
		printf 'export SILK_DATA_DIR=%q\n' "$data_dir"
		printf 'export SILK_PLUGIN_ROOT=%q\n' "$plugin_root"
		printf 'export SILK_SESSION_ID=%q\n' "$session_id"
		printf 'export SILK_PACKAGE_MANAGER=%q\n' "$package_manager"
	} > "$hook_env_file"

	if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
		for var in SILK_PROJECT_DIR SILK_DATA_DIR SILK_PLUGIN_ROOT SILK_SESSION_ID SILK_PACKAGE_MANAGER; do
			grep -q "^export ${var}=" "$CLAUDE_ENV_FILE" 2>/dev/null || \
				grep "^export ${var}=" "$hook_env_file" >> "$CLAUDE_ENV_FILE"
		done
	fi
fi

CONTEXT=$(cat <<CONTEXT
<silk_capabilities>
This is a Silk Suite workspace. The silk plugin provides the savvy-mcp server
(ten structured tools), three domain agents, the /silk:* skills, a Biome LSP,
and two background monitors (tsdoc-diagnostics watches dist/<target>/issues.json;
dogfood-mail watches .claude/dogfood/ mail and journal turn-flips). They already
encode this repo's package boundaries, conventions and exclusion rules — a
structured answer from a tool beats one reconstructed from shell stdout or
memory, so reach for the matching capability first. Bash stays the escape hatch
for anything no tool surfaces.

<mcp_tools server="savvy-mcp" prefix="mcp__plugin_silk_savvy-mcp__">
  workspace_info — layout, package names, publish/version state; the default
      for any structural fact about this repo.
  turbo_inspect — cache/graph/affected inspection; read-only, never runs tasks.
  biome_check — structured Biome diagnostics; the tool channel that applies fixes.
  changeset_inspect — the branch diff classified by owning package.
  changeset_validate — typed CSH001-CSH005 changeset-file diagnostics.
  changeset_preview — the CHANGELOG the pending changesets would produce.
  changeset_deps_detect / changeset_deps_regen — dependency changesets
      (detect reads, regen writes).
  repos_inspect / repos_manage — vendored reference repos under .repos/.
  Parameter and mode detail lives on each tool's schema.
</mcp_tools>

<agents>
  changeset-manager, turborepo, tsdoctor — scope in the agent listing. Dispatch
  changeset-manager when implementation work concludes and a changeset pass is
  due, and tsdoctor the moment a build reports API Extractor issues —
  proactively, without waiting for a slash command.
</agents>

<skills>
  /silk:changeset (--create|--squash|--list|--preview|--check),
  /silk:changeset-style, /silk:changeset-config, /silk:commit-create (load
  BEFORE composing any commit message or PR body), /silk:build, /silk:tsdoc,
  /silk:turbo, /silk:repos, /silk:dogfood, /silk:it2 (only useful when the
  <terminal> block below appears). Descriptions and auto-load triggers live in
  the skills listing.
</skills>

<biome>
The Biome LSP reports diagnostics on files you edit automatically; biome_check
covers wider checks and every fix pass; Bash biome works as the escape hatch
and draws a one-time nudge.
</biome>
${TERMINAL_BLOCK}
<active_hooks>
Guards cover commit/PR messages (the commitlint contract — load
/silk:commit-create before composing, not after a rejection), writes under
.repos/** (use repos_manage or savvy repos instead), pushes while dogfood
file: overrides are linked, and validation of any .changeset/*.md you write.
A deny explains itself. The Stop-time missing-changeset note is addressed to
the user, not you; no hook blocks for a missing changeset — that is a human
judgement CI enforces on the PR. Never work around a hook or disable a check
to get a commit through; if something blocks you, stop and tell the user.
</active_hooks>
</silk_capabilities>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

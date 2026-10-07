#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook (no matcher — fires on all starts including resume/compact):
# inject the silk capability surface into every session.
#
# Merges: changeset-env-export.sh + mcp-orientation.sh. The env-export half is
# gone: the SILK_* session variables are declared in pluginfinity.config.ts
# (`env`) and resolved once per SessionStart by the generated runner
# (lib/pluginfinity/env-run.sh), which also writes them to CLAUDE_ENV_FILE on
# Claude Code. This hook no longer writes any session state.
#
# Contract: reads the SessionStart envelope on stdin and emits
# additionalContext with a single <silk_capabilities> block: compact indexes of
# the savvy-mcp tools, agents and skills, a one-line Biome division of labor,
# and a prose active-hooks note. The block is deliberately index-shaped —
# parameter/mode detail lives on each tool's schema, skill detail in each
# skill's frontmatter description, and edit-time conventions in startup-only.sh
# (context-engineering trim, 2026-07: duplicated or on-demand-loadable detail
# does not belong in an always-on payload that re-fires on resume/compact).

# shellcheck source=../lib/pluginfinity/hook.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
# shellcheck source=../lib/silk/hook-env.sh
. "$(dirname "$0")/../lib/silk/hook-env.sh"

hook_require_input

# it2 pane-orchestration gate (savvy-web/systems, 2026-07-21 design): env +
# `command -v it2` ONLY — no it2 subprocess here. This hook fires on every
# resume/compact, and invoking it2 risks its first-use iTerm2 API-authorization
# dialog or a hang. TERMINAL_BLOCK stays empty unless BOTH the terminal program
# is iTerm2 (TERM_PROGRAM or the locale-derived LC_TERMINAL) AND the it2 CLI is
# actually on PATH; either check failing means no block, no cost.
#
# The block points at the it2 skill, so it goes out only where the build ships
# that skill (hook_has; it2 is targets.copilot: false, so Claude Code only).
TERMINAL_BLOCK=""
if hook_has skill it2 && { [ "${TERM_PROGRAM:-}" = "iTerm.app" ] || [ "${LC_TERMINAL:-}" = "iTerm2" ]; } \
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

# Build-dependent wording. The MCP prefix is the host's own spelling of the
# savvy-mcp server (hook_tool_prefix: mcp__plugin_silk_savvy-mcp__ on Claude
# Code, savvy-mcp- on Copilot). The monitors and the it2 skill are named only
# where this build ships them (hook_has): Claude Code has both, Copilot neither.
MCP_PREFIX=$(hook_tool_prefix savvy-mcp || true)
if hook_has monitor tsdoc-diagnostics && hook_has monitor dogfood-mail; then
	SURFACE='the /silk:* skills, a Biome LSP,
and two background monitors (tsdoc-diagnostics watches dist/<target>/issues.json;
dogfood-mail watches .claude/dogfood/ mail and journal turn-flips). They already'
else
	SURFACE='the /silk:* skills and a Biome LSP. They already'
fi
if hook_has skill it2; then
	SKILLS_TAIL='/silk:turbo, /silk:repos, /silk:dogfood, /silk:it2 (only useful when the
  <terminal> block below appears). Descriptions and auto-load triggers live in
  the skills listing.'
else
	SKILLS_TAIL='/silk:turbo, /silk:repos, /silk:dogfood. Descriptions and auto-load
  triggers live in the skills listing.'
fi
# Where savvy-mcp cannot learn the project (silk_mcp_needs_cwd: Copilot, whose
# MCP servers start at the plugin root with no roots and no project variable),
# every tool call must carry the project as `cwd`. Empty elsewhere, so the
# Claude Code text is unchanged.
MCP_CWD_NOTE=""
if silk_mcp_needs_cwd; then
	MCP_CWD_NOTE='
  ALWAYS pass cwd (the absolute path of the project root) to every savvy-mcp
  tool on this host: the server starts in the plugin directory and cannot
  find the project on its own, so a call without cwd inspects the wrong tree.'
fi

CONTEXT=$(cat <<CONTEXT
<silk_capabilities>
This is a Silk Suite workspace. The silk plugin provides the savvy-mcp server
(ten structured tools), three domain agents, ${SURFACE}
encode this repo's package boundaries, conventions and exclusion rules — a
structured answer from a tool beats one reconstructed from shell stdout or
memory, so reach for the matching capability first. Bash stays the escape hatch
for anything no tool surfaces.

<mcp_tools server="savvy-mcp" prefix="${MCP_PREFIX}">
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
  Parameter and mode detail lives on each tool's schema.${MCP_CWD_NOTE}
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
  BEFORE composing any commit message), /silk:pr-body (load BEFORE writing or
  editing any PR description — the marker contract that decides which regions
  survive), /silk:build, /silk:tsdoc,
  ${SKILLS_TAIL}
</skills>

<biome>
The Biome LSP reports diagnostics on files you edit automatically; biome_check
covers wider checks and every fix pass. Direct Bash Biome is DENIED (any
route: bare, path-prefixed, exec, npx/bunx/dlx, sudo/env-wrapped) except
pnpm/yarn/bun/npm lint, lint:fix, lint:fix:unsafe at the repo root — a direct
invocation skips the repo config and can corrupt .repos/** vendored
submodules.
</biome>
${TERMINAL_BLOCK}
<active_hooks>
Guards cover commit messages (the commitlint contract — load
/silk:commit-create before composing, not after a rejection) and, more
loosely, PR bodies (markdown, headers and fences are fine there; load
/silk:pr-body), writes under
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

hook_context "$CONTEXT"

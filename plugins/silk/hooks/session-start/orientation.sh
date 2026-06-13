#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook (no matcher — fires on all starts including resume/compact):
# persist namespaced SILK_* env vars and inject MCP orientation + changeset +
# dogfood-feedback context into every session.
#
# Merges: changeset-env-export.sh + mcp-orientation.sh
#
# Contract: reads SessionStart envelope on stdin, writes 5 SILK_* exports to
# the per-session silk-hook.sh file and CLAUDE_ENV_FILE, then emits
# additionalContext with TIER-1 MCP catalog nudge, TIER-2 workspace_info nudge,
# changesets plugin context, and a dogfood-feedback reminder.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

_HOOK="session-start-orientation"

# Fail open without jq.
if ! command -v jq &>/dev/null; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

hook_json=$(cat)
session_id=$(jq -r '.session_id // ""' <<< "$hook_json")
envelope_cwd=$(jq -r '.cwd // empty' <<< "$hook_json")

project_dir="${CLAUDE_PROJECT_DIR:-$envelope_cwd}"
data_dir="${CLAUDE_PLUGIN_DATA:-}"
plugin_root="${CLAUDE_PLUGIN_ROOT:-}"

# Detect package manager so reader hooks can reuse the same logic via the
# SILK_PACKAGE_MANAGER export. Fail open to "npm" if anything goes wrong.
detect_pm() {
	if [ -z "$project_dir" ] || [ ! -d "$project_dir" ]; then
		echo "npm"
		return
	fi
	if [ -f "$project_dir/package.json" ]; then
		local pm
		pm=$(jq -r '.packageManager // empty' "$project_dir/package.json" 2>/dev/null | cut -d'@' -f1)
		if [ -n "$pm" ]; then
			echo "$pm"
			return
		fi
	fi
	if [ -f "$project_dir/pnpm-lock.yaml" ]; then
		echo "pnpm"
	elif [ -f "$project_dir/yarn.lock" ]; then
		echo "yarn"
	elif [ -f "$project_dir/bun.lock" ]; then
		echo "bun"
	else
		echo "npm"
	fi
}

package_manager=$(detect_pm)

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

case "$package_manager" in
	pnpm) RUN="pnpm exec savvy changeset" ;;
	yarn) RUN="yarn exec savvy changeset" ;;
	bun)  RUN="bunx savvy changeset" ;;
	*)    RUN="npx --no -- savvy changeset" ;;
esac

CONTEXT=$(cat <<CONTEXT
<EXTREMELY_IMPORTANT>
A shared MCP server (savvy-mcp) is active this session. It serves the Silk Suite
documentation corpus and workspace analysis tools.

Before you research any Silk convention, package API, standards rule, or
architecture decision by guessing, reading source files, or running git/grep,
you ABSOLUTELY MUST first:

1. Read the resource silk://catalog — it lists every available doc grouped by
   tier (Standards, Packages, Guides) with a "load when" hint, so you fetch only
   what the task needs.
2. Use the silk_docs_search tool to find relevant docs by keyword. It returns
   ranked, scored hits and is faster and more accurate than filesystem grep.

If there is even a 1% chance the corpus answers your question, search it before
guessing. This is not negotiable.

For detailed query technique, the silk docs-search skill is available on demand.
</EXTREMELY_IMPORTANT>

<important>
When you need workspace layout, package names, publish or version state, or any
other structural fact about the workspace, call the workspace_info MCP tool
before running shell commands or answering from memory. It returns structured
JSON. Use Bash workspace commands only when:
  - you need git status or branch info (workspace_info does not cover this), or
  - you need output from a task-specific script the tool does not provide, or
  - workspace_info is unavailable or errors.

When you need to diagnose a Turborepo cache miss, inspect the task graph, or
identify which packages are affected by a change, call the turbo_inspect MCP
tool before hand-running turbo commands or guessing. It is read-only and never
executes tasks. Use Bash turbo commands only when you need a field turbo_inspect
does not surface (and always with --dry in that case).
</important>

<turbo_capability>
The savvy-mcp server provides a read-only Turborepo inspection tool:

  mcp__savvy-mcp__turbo_inspect
    mode: "cache"    — per-package HIT/MISS verdict plus the exact hash
                       contributors (input files, env vars, external-dep hashes,
                       global hash). Use for cache-miss diagnosis.
    mode: "graph"    — full task graph and critical path. Use before any
                       dependsOn / outputs / inputs refactor.
    mode: "affected" — changed-package set (what --affected would select).
                       Use to scope CI or confirm graph edges.

For lighter Turborepo questions (configuring a task, understanding dependsOn,
anti-patterns) the turbo skill is available on demand: /silk:turbo.

For multi-step cache diagnosis, turbo.json refactors, or CI cache setup,
dispatch the turborepo agent — it drives turbo_inspect, interprets the hash
contributors, and recommends concrete changes.
</turbo_capability>

<biome_capability>
Biome (the suite's linter/formatter) is wired into this session two ways:

1. LSP (automatic). After you edit a JS/TS/JSON/CSS/GraphQL file, Biome lint and
   format diagnostics are reported to you automatically. Do NOT run
   \`biome check <file>\` via Bash just to SEE problems on a file you edited — the
   diagnostics already arrive. The LSP cannot apply fixes and only sees files you
   have opened/edited.

2. mcp__savvy-mcp__biome_check (on demand, structured, can fix). Run Biome over
   any path and get parsed diagnostics back instead of console text:
     mode:   "check" (default — lint + format + imports) | "lint"
     write:  true  — apply safe fixes (--write)
     unsafe: true  — apply unsafe fixes (--write --unsafe)
   Use it for whole-package or multi-file checks and for applying fixes, instead
   of shelling out to biome.

<active_hooks>
  <hook event="PreToolUse" matcher="Bash">
    When you run Biome via Bash (directly or through a package.json script), a
    one-time, non-blocking nudge reminds you to prefer biome_check. It never
    blocks — Bash biome stays a valid escape hatch when the tool lacks a flag you
    need or the MCP server is misbehaving.
  </hook>
</active_hooks>
</biome_capability>

<changesets_plugin>

<overview>
This project uses section-aware changesets via @savvy-web/changesets. Changesets are release documentation: short markdown files in .changeset/ that describe what users upgrading the package need to know, organized under category headings.
</overview>

<style_rules>
The full style and format specification — YAML frontmatter shape, the 13 valid section headings, structural rules CSH001-CSH005, content depth tiers, and worked examples — lives in the \`changeset-style\` skill. It auto-loads whenever you read a file under .changeset/ via the path-based skill trigger, so reading or editing any changeset gives you the rules for free.

You can also invoke it on demand: \`/silk:changeset-style\`. Useful at the end of a session when context from earlier work has rotated out and you need the format reference without re-loading the SessionStart payload.
</style_rules>

<available_tools>
  <cli runner="${RUN}">
    ${RUN} check .changeset — validate all changesets with human-readable summary
    ${RUN} lint .changeset — machine-readable validation (file:line:col format)
    ${RUN} validate-file path — validate a single changeset file
    ${RUN} transform file — post-process CHANGELOG.md
    ${RUN} version — run changeset version and transform all CHANGELOGs
  </cli>

  <skills prefix="/silk:">
    /silk:changeset-create [--require] [--package N] [--bump LVL] [--dry-run]
        — reconcile changesets with the branch diff. Discovers existing
          entries, classifies the diff, applies exclusion rules, and
          decides whether to create / update / delete. The changeset-manager
          agent does the work autonomously and only asks when public-surface
          ambiguity makes a guess unsafe.
    /silk:changeset-squash [branch|all] [--package N] [--dry-run]
        — consolidate per-package changesets with identical bump mappings.
          Default scope is "branch" (only entries added since the merge
          base). "all" includes pre-existing entries.
    /silk:changeset-check    — validate existing changesets against CSH001-CSH005
    /silk:changeset-list     — overview of pending changesets
    /silk:changeset-preview  — render the combined CHANGELOG output
    /silk:changeset-style    — full style specification (also auto-loads on .changeset/*.md)
  </skills>
  <agent_dispatch>
    Both /silk:changeset-create and /silk:changeset-squash dispatch the
    changeset-manager agent. The main agent should also delegate to
    changeset-manager when implementation work concludes and a changeset
    pass is needed but no slash command has been invoked — the agent owns
    discovery, classification, and the exclusion rules.
  </agent_dispatch>
</available_tools>

<active_hooks>
  <hook event="PostToolUse" matcher="Write|Edit">
    After writing a .changeset/*.md file, the CLI automatically validates it. If validation finds issues, they are provided as context — fix the file before proceeding.
  </hook>
  <hook event="PreToolUse" matcher="Bash">
    Before git commits, you are reminded to consider whether a changeset is needed.
  </hook>
  <note>
    turbo_inspect (mcp__savvy-mcp__turbo_inspect) has no hook — it is a
    read-only MCP tool; call it directly when Turborepo questions arise.
  </note>
</active_hooks>

</changesets_plugin>

<reminder>
<dogfood_feedback>
This plugin (silk@savvy-web-systems) is newly released and is being dogfooded. During this session, if a skill, hook, the savvy CLI, or an agent such as changeset-manager returns wrong, unhelpful, or confusing results, fires incorrectly, or shows any rough edge worth improving, note it.

When you dispatch a subagent, ask it to note any such rough edges and report them back to you.

At the end of the session, surface what you noticed and ask the user, for example: "I ran into X with the silk plugin. Want me to open an issue in savvy-web/systems?" Open an issue ONLY if the user explicitly agrees, using: gh issue create --repo savvy-web/systems --title "..." --body "...". You MUST wait for explicit user confirmation before opening any issue. Never file one on your own judgement.
</dogfood_feedback>
</reminder>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: persist namespaced env vars and inject changeset context.
#
# Writes the three canonical plugin paths to a per-session env file and the
# CLAUDE_ENV_FILE so reader hooks and Bash-tool subprocesses can recover them.
# Also emits additionalContext describing the changeset format, available
# tools, and active hooks.

# shellcheck source=../lib/changesets-hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/changesets-hook-output.sh"
# shellcheck source=../lib/changesets-hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/changesets-hook-debug.sh"

_HOOK="session-start-env-export"

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
# CHANGESETS_PACKAGE_MANAGER export. Fail open to "npm" if anything goes wrong.
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
	hook_env_file="${env_dir}/changesets-hook.sh"

	{
		printf 'export CHANGESETS_PROJECT_DIR=%q\n' "$project_dir"
		printf 'export CHANGESETS_DATA_DIR=%q\n' "$data_dir"
		printf 'export CHANGESETS_PLUGIN_ROOT=%q\n' "$plugin_root"
		printf 'export CHANGESETS_SESSION_ID=%q\n' "$session_id"
		printf 'export CHANGESETS_PACKAGE_MANAGER=%q\n' "$package_manager"
	} > "$hook_env_file"

	if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
		for var in CHANGESETS_PROJECT_DIR CHANGESETS_DATA_DIR CHANGESETS_PLUGIN_ROOT CHANGESETS_SESSION_ID CHANGESETS_PACKAGE_MANAGER; do
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
</active_hooks>

</changesets_plugin>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

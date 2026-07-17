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
# additionalContext with a single <silk_capabilities> block: the savvy-mcp tool
# index, the agent and skill indexes, the Biome division of labor, and the
# active-hooks map. Edit-time conventions live in startup-only.sh; per-format
# detail stays at point-of-use (path-triggered skills, PreToolUse nudges).

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

RUN="$(package_manager_exec "$package_manager") savvy changeset"

CONTEXT=$(cat <<CONTEXT
<silk_capabilities>
This is a Silk Suite workspace. The silk plugin gives you a savvy-mcp server (10
structured tools), 3 domain agents, 9 skills, a Biome LSP, and two background
monitors — all of which already know this repo's package boundaries,
conventions and exclusion rules.

USE THEM. Shelling out to git/pnpm/turbo/biome to reconstruct what a tool returns
in one call is slower, lossier, and gets the repo-specific rules wrong. Answering
from memory about this repo's layout, release state, or lint policy is guessing.
When a question falls in a capability below, open that capability first. The tools
are cheap; a wrong answer derived from parsed stdout is not.

<mcp_tools server="savvy-mcp" prefix="mcp__plugin_silk_savvy-mcp__">
  workspace_info    — workspace layout, package names, publish/version state.
                      THE default for any structural fact about this repo.
  turbo_inspect     — read-only, never executes tasks.
                      mode:"cache"    HIT/MISS per package + the exact hash
                                      contributors (inputs, env, dep hashes,
                                      global hash). Cache-miss diagnosis.
                      mode:"graph"    task graph + critical path. Read this
                                      before any dependsOn/inputs/outputs edit.
                      mode:"affected" the changed-package set.
  biome_check       — Biome with structured diagnostics instead of console text.
                      paths[] (default: whole workspace), mode:"check"|"lint",
                      write:true (safe fixes), unsafe:true, strict:true (surface
                      project warnings as errors, tagged originalSeverity).
                      The ONLY way to apply Biome fixes from a tool. Preferred
                      over Bash biome for every check and every fix.
  changeset_inspect — mode:"branch" = the branch diff already classified by
                      owning package (+ unmappedFiles). This is how you learn
                      WHAT CHANGED and WHO OWNS IT. mode:"classify" maps
                      arbitrary paths to their package.
  changeset_validate— typed CSH001-CSH005 diagnostics for changeset files.
  changeset_preview — renders the CHANGELOG the pending changesets would produce.
                      Answers "what ships next".
  changeset_deps_detect — read-only: packages needing a Dependencies changeset.
  changeset_deps_regen  — writes them (delete-and-recreate).
  repos_inspect / repos_manage — vendored reference repos under .repos/.

  Full savvy changeset CLI: ${RUN} --help (check | lint | validate-file |
  transform | version).

  Do not infer release state from the file tree. Do not infer workspace layout
  from ls. Do not parse \`turbo --dry\` when turbo_inspect will hand you the hash
  contributors. Bash is the escape hatch for git status/branch info, task-specific
  scripts, and any field a tool genuinely does not surface.
</mcp_tools>

<agents>
  changeset-manager — reconciles changesets against the branch diff (create /
      update / delete / squash). Owns discovery, classification and the exclusion
      rules. Dispatch it when implementation work concludes and a changeset pass
      is needed — you do not have to wait for a slash command.
  turborepo — multi-step cache diagnosis, turbo.json refactors, CI cache setup.
      Drives turbo_inspect and interprets the hash contributors.
  tsdoctor — drives a package's ae-*/tsdoc-* API Extractor diagnostics to zero
      off dist/prod/issues.json, then rebuilds to confirm. Dispatch it the moment
      a build reports API Extractor issues; do not hand-patch TSDoc comments and
      never add warning suppressions.
</agents>

<skills>
  /silk:changeset        create|squash|list|preview|check changesets (bare =
                         create/reconcile; dispatches changeset-manager)
  /silk:changeset-style  the format spec — auto-loads on any .changeset/*.md
  /silk:changeset-config .changeset/config.json: versionFiles, additionalScopes
  /silk:commit-create    the commit-message contract enforced by
                         @savvy-web/commitlint — type enum, tdd scope grammar,
                         subject/body rules, DCO signoff, Closes trailers.
                         LOAD THIS BEFORE writing any commit message or PR body;
                         PR bodies are commitlint-validated too.
  /silk:build            savvy.build.ts, BuildConfig, the build:dev/build:prod/
                         types:check/prepare script contract, SEA binaries.
                         Auto-loads on savvy.build.ts, package.json, turbo.json.
  /silk:tsdoc            TSDoc that survives API Extractor: release tags, the
                         supported-tag allow-list, ae-forgotten-export and
                         friends. Your JSDoc habits are wrong here.
  /silk:turbo            Turborepo config, dependsOn, --affected/--filter,
                         anti-patterns. Lighter than the turborepo agent.
  /silk:repos            vendored reference repos under .repos/.
  /silk:dogfood          the cross-repo dogfood-loop command: mailbox, JSONL
                         journal, link/unlink. --init/--send/--status/
                         --watch/--adopt/--exit.
  Two background monitors: tsdoc-diagnostics surfaces ae-*/tsdoc- diagnostics
  from dist/<target>/issues.json as builds change them; dogfood-mail surfaces
  incoming .claude/dogfood/ mail and journal turn-flips (ball changes).
</skills>

<biome>
Biome is wired in twice, and neither way is Bash.
1. LSP (automatic, zero cost). After you edit a JS/TS/JSON/JSONC/CSS/GraphQL
   file, Biome lint and format diagnostics arrive on their own. Never run
   \`biome check <file>\` just to SEE problems on a file you edited. The LSP
   cannot apply fixes and only sees files you have touched.
2. biome_check (on demand, structured, CAN fix). Use it for whole-package and
   multi-file checks, and for every fix pass.
Bash biome still works and is never blocked — it is the escape hatch for a flag
the tool lacks. Reaching for it first draws a one-time PreToolUse nudge.
</biome>

<terminal>
The it2 CLI (installed separately) lets you control terminal sessions and panes
directly — split panes, send text to a session, read a pane's buffer, set badges.
Clean up after yourself: when idle agent sessions or panes you or a subagent
spawned are no longer in use (e.g. two idle agents left in split panes after a
task finishes), close or remove them rather than leaving clutter behind.
</terminal>

<active_hooks>
  PreToolUse  Bash / Read|Write|Edit / MCP-git — commit guards. A \`git commit\` or
      \`gh pr create|edit\` is intercepted and checked against the commitlint
      contract. Load /silk:commit-create before you compose the message, not
      after the hook rejects it.
  PreToolUse  Bash — biome-prefer-mcp: one-time, non-blocking nudge toward
      biome_check. Never blocks.
  PreToolUse  Write|Edit|Bash|MCP-git — repos guards: .repos/** is read-only
      vendored source. Mutate it only via repos_manage or \`savvy repos\`.
  PostToolUse Write|Edit — a .changeset/*.md file you write is validated
      immediately. Fix reported issues before moving on.
  Stop — a missing-changeset note addressed TO THE USER, not to you. Nothing is
      blocked; do not act on it.
  No hook blocks a commit or a push for a missing changeset — that is a human
  judgement and CI enforces it on the PR. Never work around a hook or disable a
  check to get a commit through. If something blocks you, stop and tell the user.
</active_hooks>
</silk_capabilities>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

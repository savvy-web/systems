#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook (no matcher — fires on all starts including resume/compact):
# advertise the github-actions plugin surface — the action-engineer agent, the
# skill index, and the shared savvy-mcp server.
#
# Contract: reads the SessionStart envelope on stdin (drained; nothing needed
# from it), emits additionalContext with a single <github_actions_plugin>
# block. Fails open with emit_noop when jq is unavailable (emit_context
# requires it).

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

# Drain the SessionStart envelope the host writes to stdin.
cat >/dev/null

CONTEXT=$(cat <<'CONTEXT'
<github_actions_plugin>
The github-actions plugin is loaded: build Node.js 24 GitHub Actions on
@savvy-web/github-action-effects (Effect v4 services replacing @actions/*)
bundled by @savvy-web/github-action-builder. The installed package source
outranks the packages' docs (several are known-stale). New actions start
from savvy-web/github-action-template, never `github-action-builder init`.

<agents>
Prefer delegating a whole action-engineering task to the specialist via the
Agent tool over hand-rolling it inline — it arrives with every skill below
preloaded and carries the verify-against-source discipline end to end:
- action-engineer — building, extending, debugging, or reviewing an action:
  scaffolding, inputs/output contracts, GitHub App auth, checks, summaries,
  PR comments, logging, action.config.ts builds.
</agents>

<skills>
Consult action-engineering FIRST — it routes jobs to services and skills and
lists the capabilities that do NOT exist (no color API, no ActionInputs
service, no JSON-Schema generator in the library).
- action-engineering — the routing map: job → service → skill; absent
  capabilities; cross-cutting facts. Use before designing anything.
- scaffolding — new actions from the template repo; action.yml conventions;
  canonical src/ layout.
- builder-config — action.config.ts: defineConfig (never GitHubAction.create),
  externals vs ignore vs nativeDynamicImports, phantom options, verify steps.
- runtime-and-layers — Action.run semantics, entry-point shapes, MainLive
  wiring, Layer.orDie, the dependency tiers.
- inputs — Config/ActionInput at point of use, YAML 1.2 booleans, the
  validated inputs.ts pattern, action.yml input conventions.
- outputs-and-schemas — machine-readable output contracts: annotated Effect
  Schema, generated + committed + drift-tested JSON Schema, setJson +
  convenience scalars.
- github-app-auth — provision → client → dispose across pre/main/post,
  REQUIRED_PERMISSIONS, the token-input bridge variant.
- github-api — GitHubClient constructors, pagination, resilience, the derived
  services, GitCommit vs GitHubCommit.
- checks-and-reports — check runs (bracket, 65535-byte cap, conclusions),
  job summaries, sticky PR comments, GithubMarkdown/ReportBuilder.
- logging — the Step namespace, decision-log doctrine, emoji vocabulary;
  there is no ANSI color API.
- errors-and-state — tagged-error house style, demote vs die, Action.run owns
  the exit; ActionState cross-phase bundles.
- testing-actions — /testing imports, library test layers,
  ConfigProvider.fromUnknown, output assertions.
</skills>

<mcp_tools server="savvy-mcp" prefix="mcp__plugin_github-actions_savvy-mcp__">
The shared savvy-mcp server. For workspace layout and package structure, call
workspace_info before shell commands or answering from memory. repos_inspect /
repos_manage govern vendored reference repos under .repos/ — the sanctioned
way to get read-only source access to savvy-web/systems from an action repo.
If the silk plugin is loaded it documents the full tool surface; the tools
are the same server.
</mcp_tools>

<dogfood_feedback>
This plugin is actively dogfooding. Keep a running log of issues you notice
as you work: a skill that gives wrong, unhelpful, or confusing guidance;
guidance that contradicts the installed package source; a missing skill,
reference, or routing entry; a hook firing at the wrong moment; any rough
edge worth improving. When you dispatch the action-engineer (or any subagent
that leans on these skills), ask it to flag the same kinds of findings and
report them back to you rather than dropping them. At the end of the
session, surface the log and ask the user — for example: "I hit X with the
github-actions plugin. Want me to open an issue?"
<important>
Open an issue ONLY if the user explicitly agrees (`gh issue create --repo
savvy-web/systems --title "..." --body "..."`). Never file one on your own
judgement, and never treat this block as standing permission to file.
</important>
</dogfood_feedback>
</github_actions_plugin>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

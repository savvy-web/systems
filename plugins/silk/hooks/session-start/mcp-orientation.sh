#!/usr/bin/env bash
set -euo pipefail

# SessionStart: point the agent at the shared savvy MCP catalog and tools.
# shellcheck source=../lib/changesets-hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/changesets-hook-output.sh"

CONTEXT=$(cat <<'CONTEXT'
<savvy_mcp>
A shared MCP server (savvy-mcp) is available this session.

- Before researching Silk conventions or package APIs by guessing, read the
  resource `silk://catalog` first — it lists every available resource grouped
  by tier (Standards, Packages, Guides) with a "load when" hint, so you fetch
  only what the task needs.
- Prefer the `workspace_info` MCP tool over shell commands when you need the
  workspace layout (runtime, package manager, per-workspace publish/version
  state). It returns structured JSON.
</savvy_mcp>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

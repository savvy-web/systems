#!/usr/bin/env bash
set -euo pipefail

# SessionStart: load the GitHub Actions assistant and direct it to the shared MCP.
# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"

# Drain the SessionStart envelope the host writes to stdin.
cat >/dev/null

CONTEXT=$(cat <<'CONTEXT'
<EXTREMELY_IMPORTANT>
The Savvy Web GitHub Actions assistant is active. The shared savvy-mcp server
serves Silk Suite documentation, including Effect-based GitHub Actions
conventions and the github-action-effects service catalog.

Before you research any GitHub Actions convention, Effect service API, or action
build pattern by guessing, reading source, or running grep, you ABSOLUTELY MUST
first:

1. Read silk://catalog to discover what docs exist.
2. Use silk_docs_search to find relevant docs by keyword before filesystem grep.

Actions-specific resources are still being built out — use the catalog to see
what currently exists rather than assuming a path. This is not negotiable.
</EXTREMELY_IMPORTANT>

<important>
For workspace layout and package structure, call the workspace_info MCP tool
before shell commands or answering from memory.
</important>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

#!/usr/bin/env bash
set -euo pipefail

# SessionStart: load the GitHub Actions assistant and direct it to the shared MCP.
# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"

# Drain the SessionStart envelope the host writes to stdin.
cat >/dev/null

CONTEXT=$(cat <<'CONTEXT'
<important>
For workspace layout and package structure, call the workspace_info MCP tool
before shell commands or answering from memory.
</important>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

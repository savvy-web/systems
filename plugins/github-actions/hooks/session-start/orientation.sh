#!/usr/bin/env bash
set -euo pipefail

# SessionStart: confirm the github-actions assistant loaded and point at the
# shared MCP. Actions-specific resources are future buildout.
# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"

CONTEXT=$(cat <<'CONTEXT'
<github_actions_assistant>
The Savvy Web GitHub Actions assistant is active. GitHub Actions knowledge is
served through the shared savvy MCP — read `silk://catalog` to discover
available resources. Actions-specific tools and resources are forthcoming.
</github_actions_assistant>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

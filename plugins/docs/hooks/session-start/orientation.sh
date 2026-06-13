#!/usr/bin/env bash
set -euo pipefail

# SessionStart: announce the docs authoring assistant and point at the corpus.
# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"

# Drain the SessionStart envelope the host writes to stdin.
cat >/dev/null

CONTEXT=$(cat <<'CONTEXT'
<docs_authoring_assistant>
The Savvy Web documentation assistant is active alongside the shared savvy-mcp
server. To author or improve corpus docs, dispatch the mcp agent (or run
/docs:write-guide or /docs:improve). The agent knows the corpus front-matter
schema, tier rules, tag vocabulary, and the build:catalog integrity gate.
</docs_authoring_assistant>

<important>
Before researching any doc path, tag, tier rule, or existing content, you SHOULD:
1. Read silk://catalog to discover what exists — it lists every doc with a "load when" hint.
2. Use mcp__plugin_docs_savvy-mcp__silk_docs_search to find content by keyword — faster and more accurate than filesystem grep.

Use filesystem Read/Grep/Glob only after the catalog and search come up empty, or when you need source code rather than docs.
</important>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

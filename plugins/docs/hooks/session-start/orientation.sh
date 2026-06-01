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

Before researching anything, read silk://catalog and prefer silk_docs_search
over filesystem grep.
</docs_authoring_assistant>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"

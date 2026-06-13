#!/usr/bin/env bash
# show-contract.sh — print the CURRENT corpus contract from the live source in a
# resolved savvy-web/systems checkout, so authoring never relies on a stale copy.
#
# Resolution: $SAVVY_SYSTEMS_DIR, else the current git repo if it is
# savvy-web/systems. The agent sets SAVVY_SYSTEMS_DIR when it resolved the
# checkout by another means.

set -euo pipefail

SYSTEMS_DIR="${SAVVY_SYSTEMS_DIR:-}"
if [ -z "$SYSTEMS_DIR" ]; then
	base="${CLAUDE_PROJECT_DIR:-$(pwd)}"
	if git -C "$base" remote get-url origin 2>/dev/null | grep -q 'savvy-web/systems'; then
		SYSTEMS_DIR="$(git -C "$base" rev-parse --show-toplevel)"
	fi
fi
if [ -z "$SYSTEMS_DIR" ] || [ ! -d "$SYSTEMS_DIR/packages/mcp" ]; then
	echo "ERROR: savvy-web/systems checkout not found. Set SAVVY_SYSTEMS_DIR=<path>." >&2
	exit 1
fi

MCP="$SYSTEMS_DIR/packages/mcp"
SCHEMA="$MCP/src/resources/schema.ts"
TAGS="$MCP/public/content/tags.json"
COMPILE="$MCP/lib/scripts/compile.ts"
BUILD="$MCP/lib/scripts/build-catalog.ts"

echo "## Front-matter schema (live from schema.ts)"
echo '```ts'
sed -n '/^const ID_PATTERN/,/^export type DocFrontMatter/p' "$SCHEMA"
echo '```'
echo
echo "## Controlled tag vocabulary (live from tags.json — canonical: [aliases])"
echo '```json'
cat "$TAGS"
echo '```'
echo
echo "## Forbidden dead names (live from compile.ts — must not appear in any body)"
echo '```ts'
sed -n '/const DEAD_NAMES/,/];/p' "$COMPILE"
echo '```'
echo
echo "## Per-tier body budgets in bytes (live from build-catalog.ts)"
grep -n "bodyBudgetBytes" "$BUILD" || true

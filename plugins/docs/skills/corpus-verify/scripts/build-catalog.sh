#!/usr/bin/env bash
# build-catalog.sh — run the corpus integrity gate in a resolved systems checkout.
# Pass-through of build:catalog stderr; exits with turbo's exit code.
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

cd "$SYSTEMS_DIR"
exec pnpm exec turbo run build:catalog --filter @savvy-web/mcp

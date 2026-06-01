#!/usr/bin/env sh
# Launch the savvy MCP server via the project's package manager.
set -eu

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
export CLAUDE_PROJECT_DIR="$ROOT"

detect_pm() {
	if [ -f "$ROOT/package.json" ] && command -v jq >/dev/null 2>&1; then
		pm=$(jq -r '.packageManager // empty' "$ROOT/package.json" 2>/dev/null | cut -d'@' -f1)
		if [ -n "$pm" ]; then
			echo "$pm"
			return
		fi
	fi
	if [ -f "$ROOT/pnpm-lock.yaml" ]; then echo "pnpm";
	elif [ -f "$ROOT/yarn.lock" ]; then echo "yarn";
	elif [ -f "$ROOT/bun.lock" ]; then echo "bun";
	else echo "npm"; fi
}

PM=$(detect_pm)
case "$PM" in
	pnpm) exec pnpm exec savvy-mcp "$@" ;;
	yarn) exec yarn exec savvy-mcp "$@" ;;
	bun)  exec bunx savvy-mcp "$@" ;;
	*)    exec npx --no -- savvy-mcp "$@" ;;
esac

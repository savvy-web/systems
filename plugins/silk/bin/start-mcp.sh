#!/usr/bin/env sh
# start-mcp.sh — plugin MCP server loader.
#
# Launched by .claude-plugin/plugin.json as `sh ${CLAUDE_PLUGIN_ROOT}/bin/start-mcp.sh`,
# so this file stays POSIX sh and never relies on its exec bit (the
# pre-commit hook strips it by design — savvy-web/systems#289).
#
# The exec target is always either the project's OWN node_modules/.bin/savvy-mcp
# (installed by the @savvy-web/silk carrier package, which owns the bin entry)
# or `npx --yes @savvy-web/mcp` — never a package-manager dispatch
# (`pnpm exec` / `yarn exec` / `bunx`). Those dispatches were the bug: they
# resolved the bin through the manager's own workspace rules rather than the
# project's installed tree.
#
# The package manager is detected ONLY to choose the install-command line in
# the not-installed message. Detection order: package.json's packageManager
# field (read with grep/sed — zero jq dependency at runtime) wins outright;
# otherwise the first lockfile present, in the order pnpm-lock.yaml, bun.lock,
# bun.lockb, yarn.lock, package-lock.json; otherwise npm.
#
# Both CLAUDE_PROJECT_DIR and SAVVY_MCP_PROJECT_DIR are exported: the server
# resolves its project dir from argv, then SAVVY_MCP_PROJECT_DIR, then
# CLAUDE_PROJECT_DIR, then cwd.

set -eu

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
export CLAUDE_PROJECT_DIR="$ROOT"
export SAVVY_MCP_PROJECT_DIR="$ROOT"

# detect_pm — prints one of npm/pnpm/yarn/bun on stdout. Package.json's
# packageManager field wins outright over any lockfile (even a co-present
# one); otherwise the first lockfile present in source order wins; npm is
# the default.
detect_pm() {
	pm=""
	if [ -f "$ROOT/package.json" ]; then
		pm=$(grep -o '"packageManager"[[:space:]]*:[[:space:]]*"[^"]*"' "$ROOT/package.json" 2>/dev/null |
			sed -E 's/.*:[[:space:]]*"([a-z]+)@.*/\1/')
	fi
	case "$pm" in
		npm | pnpm | yarn | bun)
			printf '%s\n' "$pm"
			return
			;;
	esac
	if [ -f "$ROOT/pnpm-lock.yaml" ]; then
		printf '%s\n' "pnpm"
	elif [ -f "$ROOT/bun.lock" ]; then
		printf '%s\n' "bun"
	elif [ -f "$ROOT/bun.lockb" ]; then
		printf '%s\n' "bun"
	elif [ -f "$ROOT/yarn.lock" ]; then
		printf '%s\n' "yarn"
	elif [ -f "$ROOT/package-lock.json" ]; then
		printf '%s\n' "npm"
	else
		printf '%s\n' "npm"
	fi
}

# install_line pm — prints the one install command line matching pm.
install_line() {
	case "$1" in
		pnpm) printf '  pnpm add -D @savvy-web/silk\n' ;;
		yarn) printf '  yarn add -D @savvy-web/silk\n' ;;
		bun) printf '  bun add -d @savvy-web/silk\n' ;;
		*) printf '  npm install --save-dev @savvy-web/silk\n' ;;
	esac
}

BIN="$ROOT/node_modules/.bin/savvy-mcp"
if [ -x "$BIN" ]; then
	exec "$BIN" "$@"
fi

PM="$(detect_pm)"
{
	printf 'silk plugin: savvy-mcp is not installed in this project.\n'
	printf '\n'
	printf 'Detected package manager: %s\n' "$PM"
	printf 'Project directory: %s\n' "$ROOT"
	printf '\n'
	printf 'Install it with:\n'
	install_line "$PM"
	printf '\n'
	printf 'Falling back to npx --yes @savvy-web/mcp, which will download it.\n'
} >&2

exec npx --yes @savvy-web/mcp "$@"

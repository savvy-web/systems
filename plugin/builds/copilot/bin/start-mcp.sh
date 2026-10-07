#!/usr/bin/env sh
# start-mcp.sh — the savvy-mcp server launcher, written on pluginfinity's
# server library.
#
# Launched as `sh ${PLUGIN_ROOT}/bin/start-mcp.sh`, so this file stays POSIX sh
# and never relies on its exec bit (the pre-commit hook strips it by design —
# savvy-web/systems#289).
#
# The exec target is always either the project's OWN node_modules/.bin/savvy-mcp
# (installed by the @savvy-web/silk carrier package, which owns the bin entry)
# or `npx --yes @savvy-web/mcp` — never a package-manager dispatch
# (`pnpm exec` / `yarn exec` / `bunx`). Those dispatches were the bug: they
# resolved the bin through the manager's own workspace rules rather than the
# project's installed tree. server_exec_bin does exactly that, and names
# @savvy-web/silk in the install hint.
#
# When a project directory is known, both CLAUDE_PROJECT_DIR and
# SAVVY_MCP_PROJECT_DIR are exported: the server resolves its project dir from
# argv, then SAVVY_MCP_PROJECT_DIR, then CLAUDE_PROJECT_DIR, then cwd. On
# Copilot an MCP server starts at the plugin root with no project directory, so
# nothing is exported and the server falls back to its own resolution.

set -eu
# shellcheck source=../lib/pluginfinity/server.sh
. "$PLUGINFINITY_LIB/server.sh"

if ROOT=$(server_project_dir); then
	export CLAUDE_PROJECT_DIR="$ROOT"
	export SAVVY_MCP_PROJECT_DIR="$ROOT"
fi

server_exec_bin savvy-mcp @savvy-web/mcp --install @savvy-web/silk "$@"

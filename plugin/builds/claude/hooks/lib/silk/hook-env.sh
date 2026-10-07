# shellcheck shell=bash
# hook-env.sh — silk's own hook helpers, layered on the pluginfinity hook
# library. Source it from a hook script AFTER the library:
#
#   . "$(dirname "$0")/../lib/pluginfinity/hook.sh"
#   . "$(dirname "$0")/../lib/silk/hook-env.sh"
#
# The library owns stdin, the response, the EXIT trap, input validation
# (hook_require_input), project-dir resolution (hook_project_dir,
# hook_cd_project, hook_session_dir) and relaying a Claude-shaped response
# (hook_envelope, hook_relay). Everything here is plugin logic the library has
# no opinion on: package-manager detection and the `savvy` CLI runner.
#
# Project dir (savvy-web/systems#274): hooks use hook_project_dir, which reads
# an absolute input cwd first (walked up to the nearest .git, so a worktree's
# .git file counts; a cwd with none is taken as given) and only then
# CLAUDE_PROJECT_DIR. It never answers empty, so no hook has a "no project"
# branch. CLAUDE_PROJECT_DIR is pinned to
# the PRIMARY checkout for the whole session and does not follow a worktree, so
# a hook reasoning about git state must never prefer it; hook_session_dir is
# the one that does, for the rare hook that wants the session's checkout.

# Directory holding silk's own helpers (this file's directory).
SILK_HOOK_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# detect_package_manager <project-dir> — echo pnpm | yarn | bun | npm.
#
# Resolution order, first hit wins:
#   1. package.json devEngines.packageManager.name (first entry when an array),
#      then the legacy "packageManager" field (the corepack declaration).
#   2. A lockfile: pnpm-lock.yaml, then yarn.lock, then bun.lock.
#   3. npm.
#
# FAILS OPEN TO npm at every step. scripts/env-setup.sh prints what this
# returns as the SILK_PACKAGE_MANAGER session variable, and readers that see it
# empty (the config default) call it themselves.
detect_package_manager() {
	local root="${1:-}"

	if [ -z "$root" ] || [ ! -d "$root" ]; then
		printf 'npm'
		return
	fi

	if [ -f "${root}/package.json" ]; then
		local pm
		pm=$(jq -r '(.devEngines.packageManager | if type == "array" then .[0] else . end | .name?) // .packageManager // empty' "${root}/package.json" 2>/dev/null | cut -d'@' -f1 || true)
		if [ -n "$pm" ]; then
			printf '%s' "$pm"
			return
		fi
	fi

	if [ -f "${root}/pnpm-lock.yaml" ]; then
		printf 'pnpm'
	elif [ -f "${root}/yarn.lock" ]; then
		printf 'yarn'
	elif [ -f "${root}/bun.lock" ]; then
		printf 'bun'
	else
		printf 'npm'
	fi
}

# package_manager_exec <package-manager> — echo the runner prefix that invokes a
# workspace-local binary with that package manager. Unknown or empty input
# falls open to the npm form.
package_manager_exec() {
	case "${1:-}" in
		pnpm) printf 'pnpm exec' ;;
		yarn) printf 'yarn exec' ;;
		bun) printf 'bunx' ;;
		*) printf 'npx --no --' ;;
	esac
}

# silk_mcp_needs_cwd — 0 when savvy-mcp cannot learn the project on this host,
# so every tool call must pass the project as `cwd`; 1 when it can.
#
# Answered by the library's `hook_supports server-project`, the hook-side twin
# of server_project_dir: Claude Code gives an MCP server CLAUDE_PROJECT_DIR and
# roots; Copilot starts it at the plugin root with neither (measured
# 2026-10-07).
silk_mcp_needs_cwd() {
	! hook_supports server-project
}

# silk_cli_runner — echo the runner prefix for the `savvy` CLI, detected from
# hook_project_dir (the tool call's tree, worktree-correct).
silk_cli_runner() {
	package_manager_exec "$(detect_package_manager "$(hook_project_dir)")"
}

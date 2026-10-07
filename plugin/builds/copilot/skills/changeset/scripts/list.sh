#!/usr/bin/env bash
# list.sh — Emit structured listing of pending changesets as JSON.
# Bundled with the `changeset` skill's --list mode.
#
# Uses @changesets/cli's built-in `status --output=<file>` to produce JSON
# describing every pending changeset (releases, packages, bump levels,
# commit info). The CLI is assumed installed — it is shipped alongside
# @savvy-web/changesets as a peer/dev dependency.
#
# Output: JSON document on stdout.
# Exit code: 0 on success, 1 if CLI is missing or .changeset/ is absent.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# A skill script run through the Bash tool gets no plugin variables from the
# host, so the dirname walk is the normal path: three levels up from
# skills/changeset/scripts is the plugin root. CLAUDE_PLUGIN_ROOT wins only when
# a caller sets it.
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "${SCRIPT_DIR}/../../.." && pwd)}"
# shellcheck source=../../../hooks/lib/silk/resolve-cli-project-dir.sh
. "${PLUGIN_ROOT}/hooks/lib/silk/resolve-cli-project-dir.sh"

# pluginfinity's logging standard (lib/pluginfinity/log.sh): script_log appends
# to $XDG_STATE_HOME/pluginfinity/silk/error.log, script_debug to debug.log under
# PLUGINFINITY_DEBUG=1. Neither writes to stdout. No-ops when the file is absent.
_pf_log_dir="${PLUGIN_ROOT}/lib/pluginfinity"
# shellcheck source=../../../lib/pluginfinity/log.sh
. "${_pf_log_dir}/log.sh" 2>/dev/null || {
	script_log() { :; }
	script_debug() { :; }
}

# Cwd-first project root resolution (see resolve-cli-project-dir.sh):
# `git -C "$PWD" rev-parse --show-toplevel` is the primary authority, so a
# worktree-isolated invocation resolves its OWN worktree, not the main
# checkout SILK_PROJECT_DIR/CLAUDE_PROJECT_DIR are pinned to
# (savvy-web/systems#706, #474, #434, #418).
PROJECT_DIR=$(resolve_cli_project_dir) || exit 1
if [ ! -d "$PROJECT_DIR" ]; then
	echo "ERROR: project dir not found: $PROJECT_DIR" >&2
	exit 1
fi
cd "$PROJECT_DIR"

# The session variables (pluginfinity.config.ts `env`): SILK_PACKAGE_MANAGER,
# detected once per SessionStart by scripts/env-setup.sh. Sourced after the cd
# so the project pointer resolves for this project. On Claude Code the
# session's own values file wins (CLAUDE_CODE_SESSION_ID); on Copilot, which
# has no env channel to the model's shell, this is how the value arrives.
# Writes nothing to stdout and fails open. The path is built from the absolute
# SCRIPT_DIR, not "$(dirname "$0")": after the cd a relative $0 no longer
# resolves.
_pf_lib_dir="${SCRIPT_DIR}/../../../lib/pluginfinity"
# shellcheck source=../../../lib/pluginfinity/env.sh
. "$_pf_lib_dir/env.sh"

if [ ! -d .changeset ]; then
	echo '{"changesets":[],"releases":[],"note":"no .changeset/ directory"}'
	exit 0
fi

PM="${SILK_PACKAGE_MANAGER:-}"
if [ -z "$PM" ]; then
	if [ -f package.json ] && command -v jq >/dev/null 2>&1; then
		PM=$(jq -r '(.devEngines.packageManager | if type == "array" then .[0] else . end | .name?) // .packageManager // empty' package.json 2>/dev/null | cut -d'@' -f1)
	fi
	if [ -z "$PM" ]; then
		if [ -f pnpm-lock.yaml ]; then PM=pnpm
		elif [ -f yarn.lock ]; then PM=yarn
		elif [ -f bun.lock ]; then PM=bun
		else PM=npm
		fi
	fi
fi

case "$PM" in
	pnpm) CMD=(pnpm exec changeset) ;;
	yarn) CMD=(yarn exec changeset) ;;
	bun)  CMD=(bunx changeset) ;;
	*)    CMD=(npx --no -- changeset) ;;
esac

if ! "${CMD[@]}" --version >/dev/null 2>&1; then
	script_log "@changesets/cli is not installed in $PROJECT_DIR"
	echo "ERROR: @changesets/cli is not installed in $PROJECT_DIR" >&2
	echo "Install @changesets/cli as a dev dependency to use this skill." >&2
	exit 1
fi

tmpfile=$(mktemp -t changeset-status.XXXXXX.json)
trap 'rm -f "$tmpfile"' EXIT

# `changeset status --output` writes JSON describing pending releases. Any
# stderr noise from the CLI (e.g., "🦋 The following packages will be
# bumped...") is suppressed; we only want the structured output.
"${CMD[@]}" status --output="$tmpfile" >/dev/null 2>&1 || {
	script_log "changeset status exited non-zero in $PROJECT_DIR"
	echo "ERROR: 'changeset status' exited non-zero" >&2
	exit 1
}

cat "$tmpfile"

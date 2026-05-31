#!/usr/bin/env bash
# check.sh — Run @savvy-web/changesets validation against .changeset/.
# Bundled with the `check` skill.
#
# Reads CHANGESETS_PROJECT_DIR and CHANGESETS_PACKAGE_MANAGER (set by the
# SessionStart hook) when available; otherwise resolves them from the
# current working directory and project metadata.
#
# Output: pass-through of `savvy-changesets check .changeset` stdout/stderr.
# Exit code: 0 on success, 1 if CLI is missing, otherwise the CLI's own
# exit code (non-zero on validation failures).

set -euo pipefail

PROJECT_DIR="${CHANGESETS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
if [ ! -d "$PROJECT_DIR" ]; then
	echo "ERROR: project dir not found: $PROJECT_DIR" >&2
	exit 1
fi
cd "$PROJECT_DIR"

if [ ! -d .changeset ]; then
	echo "No .changeset/ directory in $PROJECT_DIR — nothing to validate."
	exit 0
fi

PM="${CHANGESETS_PACKAGE_MANAGER:-}"
if [ -z "$PM" ]; then
	if [ -f package.json ] && command -v jq >/dev/null 2>&1; then
		PM=$(jq -r '.packageManager // empty' package.json 2>/dev/null | cut -d'@' -f1)
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
	pnpm) CMD=(pnpm exec savvy-changesets) ;;
	yarn) CMD=(yarn exec savvy-changesets) ;;
	bun)  CMD=(bunx savvy-changesets) ;;
	*)    CMD=(npx --no -- savvy-changesets) ;;
esac

if ! "${CMD[@]}" --version >/dev/null 2>&1; then
	echo "ERROR: savvy-changesets CLI is not installed in $PROJECT_DIR" >&2
	echo "Install @savvy-web/changesets as a dev dependency to use this skill." >&2
	exit 1
fi

exec "${CMD[@]}" check .changeset

#!/usr/bin/env bash
# list.sh — Emit structured listing of pending changesets as JSON.
# Bundled with the `list` skill.
#
# Uses @changesets/cli's built-in `status --output=<file>` to produce JSON
# describing every pending changeset (releases, packages, bump levels,
# commit info). The CLI is assumed installed — it is shipped alongside
# @savvy-web/changesets as a peer/dev dependency.
#
# Output: JSON document on stdout.
# Exit code: 0 on success, 1 if CLI is missing or .changeset/ is absent.

set -euo pipefail

PROJECT_DIR="${CHANGESETS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
if [ ! -d "$PROJECT_DIR" ]; then
	echo "ERROR: project dir not found: $PROJECT_DIR" >&2
	exit 1
fi
cd "$PROJECT_DIR"

if [ ! -d .changeset ]; then
	echo '{"changesets":[],"releases":[],"note":"no .changeset/ directory"}'
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
	pnpm) CMD=(pnpm exec changeset) ;;
	yarn) CMD=(yarn exec changeset) ;;
	bun)  CMD=(bunx changeset) ;;
	*)    CMD=(npx --no -- changeset) ;;
esac

if ! "${CMD[@]}" --version >/dev/null 2>&1; then
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
	echo "ERROR: 'changeset status' exited non-zero" >&2
	exit 1
}

cat "$tmpfile"

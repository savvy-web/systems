#!/usr/bin/env bash
# lint.sh — Machine-readable changeset validation (file:line:col format).
# Bundled with the `check` skill alongside check.sh.
#
# Wraps `savvy changeset lint .changeset`. Use this when you want output
# that can be programmatically parsed (e.g., to feed into Edit tool fixes);
# use check.sh for the human-readable summary.

set -euo pipefail

PROJECT_DIR="${SILK_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
if [ ! -d "$PROJECT_DIR" ]; then
	echo "ERROR: project dir not found: $PROJECT_DIR" >&2
	exit 1
fi
cd "$PROJECT_DIR"

if [ ! -d .changeset ]; then
	echo "No .changeset/ directory in $PROJECT_DIR — nothing to lint."
	exit 0
fi

PM="${SILK_PACKAGE_MANAGER:-}"
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
	pnpm) CMD=(pnpm exec savvy) ;;
	yarn) CMD=(yarn exec savvy) ;;
	bun)  CMD=(bunx savvy) ;;
	*)    CMD=(npx --no -- savvy) ;;
esac

if ! "${CMD[@]}" --version >/dev/null 2>&1; then
	echo "ERROR: savvy CLI is not installed in $PROJECT_DIR" >&2
	echo "Install @savvy-web/cli as a dev dependency (or ensure Silk Suite tooling is set up) to use this skill." >&2
	exit 1
fi

exec "${CMD[@]}" changeset lint .changeset

#!/usr/bin/env bash
# regen.sh — Thin wrapper around `savvy-changesets deps regen --json`.
#
# DESTRUCTIVE: deletes every pure dependency changeset in `.changeset/`
# (strict definition: single-package frontmatter + only a `## Dependencies`
# section) and writes one fresh single-package `patch`-bump changeset per
# workspace package with current dep changes.
#
# Forwards `--dry-run`, `--package`, `--base` as needed. Output is the
# structured plan JSON regardless of dry-run mode.

set -euo pipefail

PROJECT_DIR="${CHANGESETS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
if [ ! -d "$PROJECT_DIR" ]; then
	echo "ERROR: project dir not found: $PROJECT_DIR" >&2
	exit 1
fi
cd "$PROJECT_DIR"

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
	exit 1
fi

exec "${CMD[@]}" deps regen --json "$@"

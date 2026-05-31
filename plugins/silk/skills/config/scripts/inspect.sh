#!/usr/bin/env bash
# inspect.sh — Thin wrapper around `savvy-changesets config show --json`.
#
# Surfaces the resolved `.changeset/config.json` for the changeset-manager
# agent. The heavy lifting (JSONC parsing, schema validation, workspace
# resolution, glob materialization, overlap detection) is done by the
# CLI; this script's only job is package-manager detection plus the
# pass-through invocation.
#
# Output: JSON document on stdout from `savvy-changesets config show --json`.
# Errors: CLI exits non-zero with a human-readable message on stderr when
# the config is missing or invalid. The script preserves that contract —
# callers must check the exit code, not look for an `error` field in JSON.
#
# Args forwarded to the CLI: any flags passed to this script ($@) are
# appended verbatim (e.g., `bash inspect.sh --cwd /some/path`).

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

exec "${CMD[@]}" config show --json "$@"

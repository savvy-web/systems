#!/usr/bin/env bash
# analyze-branch.sh — Thin wrapper around `savvy changeset analyze-branch --json`.
#
# This is the single CLI call that powers the changeset-manager agent's
# create-mode inventory + classification step. The result combines a git
# diff against the base branch with per-file package attribution from
# `ConfigInspector`, returning:
#
#   { baseBranch, mergeBaseSha, files: [...], packagesAffected: [...],
#     unmappedFiles: [...] }
#
# The agent should ask the user about entries in `unmappedFiles`; the
# rest of `files` already carries `package` + `reason` attribution that
# does not require inference.
#
# Args forwarded to the CLI: pass any flags ($@) — typically `--base <branch>`
# to override the auto-detected base.

set -euo pipefail

PROJECT_DIR="${SILK_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
if [ ! -d "$PROJECT_DIR" ]; then
	echo "ERROR: project dir not found: $PROJECT_DIR" >&2
	exit 1
fi
cd "$PROJECT_DIR"

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

exec "${CMD[@]}" changeset analyze-branch --json "$@"

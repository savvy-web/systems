#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: validate changeset files after Write|Edit.
# Reads hook input JSON from stdin, checks if the file is a changeset,
# runs the savvy changeset CLI to validate it, and emits findings as
# additionalContext. Never blocks the tool call.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/source-session-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/source-session-env.sh"

_HOOK="post-tool-use-validate-changeset"

# Fail open without jq.
if ! command -v jq &>/dev/null; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

input=$(cat)
session_id=$(jq -r '.session_id // ""' <<< "$input")
if [ -n "$session_id" ]; then
	source_session_env "$session_id"
fi

file_path=$(jq -r '.tool_input.file_path // empty' <<< "$input")

if [ -z "$file_path" ]; then
	emit_noop
	exit 0
fi

# Only validate .md files directly inside a .changeset/ directory.
# Exclude README.md, which is not a changeset.
if [[ ! "$file_path" =~ \.changeset/[^/]+\.md$ ]]; then
	emit_noop
	exit 0
fi
if [[ "$file_path" =~ \.changeset/README\.md$ ]]; then
	emit_noop
	exit 0
fi

# Resolve project root via three-tier fallback. SILK_PROJECT_DIR
# survives subshells via the per-session env file written by SessionStart.
project_dir="${SILK_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [ -z "$project_dir" ]; then
	project_dir=$(pwd)
fi

# Resolve package manager. Prefer the value SessionStart already detected
# so we don't re-stat files on every tool call.
PM="${SILK_PACKAGE_MANAGER:-}"
if [ -z "$PM" ]; then
	if [ -f "$project_dir/package.json" ]; then
		PM=$(jq -r '.packageManager // empty' "$project_dir/package.json" 2>/dev/null | cut -d'@' -f1)
	fi
	if [ -z "$PM" ]; then
		if [ -f "$project_dir/pnpm-lock.yaml" ]; then
			PM=pnpm
		elif [ -f "$project_dir/yarn.lock" ]; then
			PM=yarn
		elif [ -f "$project_dir/bun.lock" ]; then
			PM=bun
		else
			PM=npm
		fi
	fi
fi

case "$PM" in
	pnpm) cmd=(pnpm exec savvy changeset) ;;
	yarn) cmd=(yarn exec savvy changeset) ;;
	bun)  cmd=(bunx savvy changeset) ;;
	*)    cmd=(npx --no -- savvy changeset) ;;
esac

# Skip silently if the CLI isn't installed in the project.
if ! "${cmd[@]}" --version &>/dev/null; then
	hook_debug "$_HOOK" "savvy CLI not available; skipping validation"
	emit_noop
	exit 0
fi

# Run validation. Capture output regardless of exit code; `set -e` would
# otherwise abort the script when the CLI exits non-zero on validation
# failures, which is the path we actually want to handle.
result=""
validate_exit=0
result=$("${cmd[@]}" validate-file "$file_path" 2>&1) || validate_exit=$?

if [ "$validate_exit" -ne 0 ]; then
	emit_context "PostToolUse" "Changeset validation found issues. Please fix before proceeding:
${result}"
	exit 0
fi

emit_noop

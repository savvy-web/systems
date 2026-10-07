#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: validate changeset files after Write|Edit.
# Reads hook input JSON from stdin, checks if the file is a changeset,
# runs the savvy changeset CLI to validate it, and emits findings as
# additionalContext. Never blocks the tool call.

# shellcheck source=../lib/pluginfinity/hook.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
# shellcheck source=../lib/silk/hook-env.sh
. "$(dirname "$0")/../lib/silk/hook-env.sh"

hook_require_input

file_path=$(hook_input tool_input.file_path)

if [ -z "$file_path" ]; then
	hook_noop
	exit 0
fi

# Only validate .md files directly inside a .changeset/ directory.
# Exclude README.md, which is not a changeset.
if [[ ! "$file_path" =~ \.changeset/[^/]+\.md$ ]]; then
	hook_noop
	exit 0
fi
if [[ "$file_path" =~ \.changeset/README\.md$ ]]; then
	hook_noop
	exit 0
fi

# Resolve the tree the Write/Edit actually landed in (hook_project_dir: the
# input's cwd first). A changeset written from an agent worktree lives in THAT
# tree, not in the session's primary checkout, so validating it against
# CLAUDE_PROJECT_DIR would resolve a relative path against the wrong root.
project_dir=$(hook_project_dir)

# Resolve package manager. Prefer the session value scripts/env-setup.sh
# detected at SessionStart (the hook library applies it before this body) so we
# don't re-stat files on every tool call; it is empty when the runner has not
# written one.
PM="${SILK_PACKAGE_MANAGER:-}"
if [ -z "$PM" ]; then
	PM=$(detect_package_manager "$project_dir")
fi

# Copilot runs hooks from the plugin root: run the CLI from the project so a
# relative file_path and the CLI's own config lookup both resolve there.
hook_cd_project || true

case "$PM" in
	pnpm) cmd=(pnpm exec savvy changeset) ;;
	yarn) cmd=(yarn exec savvy changeset) ;;
	bun)  cmd=(bunx savvy changeset) ;;
	*)    cmd=(npx --no -- savvy changeset) ;;
esac

# Skip silently if the CLI isn't installed in the project.
if ! "${cmd[@]}" --version &>/dev/null; then
	hook_debug "savvy CLI not available; skipping validation"
	hook_noop
	exit 0
fi

# Run validation. Capture output regardless of exit code; `set -e` would
# otherwise abort the script when the CLI exits non-zero on validation
# failures, which is the path we actually want to handle.
result=""
validate_exit=0
result=$("${cmd[@]}" validate-file "$file_path" 2>&1) || validate_exit=$?

if [ "$validate_exit" -ne 0 ]; then
	hook_context "Changeset validation found issues. Please fix before proceeding:
${result}"
	exit 0
fi

hook_noop

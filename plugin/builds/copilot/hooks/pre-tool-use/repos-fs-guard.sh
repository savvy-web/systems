#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: deny Write/Edit/NotebookEdit into "${PROJECT_DIR}/.repos/**"
# (vendored, read-only reference source). ".repos/config.json" is host-repo
# content and stays hand-editable. Everything else is left alone.
#
# This is a tripwire, not a security boundary: the sanctioned mutation paths
# are the repos_manage MCP tool and the `savvy repos` CLI, both named in the
# deny reason.
#
# Fails open: no jq, a malformed envelope, or no resolvable project dir all
# emit a no-op and let the tool call proceed to normal permissioning.

# shellcheck source=../lib/pluginfinity/hook.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
# shellcheck source=../lib/silk/hook-env.sh
. "$(dirname "$0")/../lib/silk/hook-env.sh"

hook_require_input

TOOL=$(hook_input tool_name)
case "$TOOL" in
	Write|Edit|NotebookEdit) ;;
	*) exit 0 ;;
esac

PATH_ARG=$(hook_input tool_input.file_path)
[ -n "$PATH_ARG" ] || PATH_ARG=$(hook_input tool_input.notebook_path)
[ -z "$PATH_ARG" ] && exit 0

# The tree the call runs in: the input's cwd walked up to its .git
# (worktree-correct, savvy-web/systems#274), then CLAUDE_PROJECT_DIR.
PROJECT_DIR=$(hook_project_dir)

case "$PATH_ARG" in
	/*) ABS="$PATH_ARG" ;;
	*)  ABS="${PROJECT_DIR}/${PATH_ARG}" ;;
esac

case "$ABS" in
	"${PROJECT_DIR}/.repos/config.json") exit 0 ;;
	"${PROJECT_DIR}/.repos/"*)
		hook_deny ".repos/** is vendored read-only reference source. Use repos_manage (or savvy repos) to mutate vendored repos; edit .repos/config.json for notes and orientation."
		;;
esac
exit 0

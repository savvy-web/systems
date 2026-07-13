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

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/repos-fs-guard"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"

TOOL=$(jq -r '.tool_name // empty' <<< "$HOOK_ENVELOPE")
case "$TOOL" in
	Write|Edit|NotebookEdit) ;;
	*) exit 0 ;;
esac

PATH_ARG=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<< "$HOOK_ENVELOPE")
[ -z "$PATH_ARG" ] && exit 0

# Resolve the project dir rather than dereferencing CLAUDE_PROJECT_DIR
# directly: under `set -u` an unset variable would abort the hook with an
# unbound-variable error instead of failing open, which is the posture every
# other hook takes. With nothing to resolve we cannot say what is inside
# .repos/, so say nothing — guessing with pwd could wrongly deny (or allow) a
# write under an unrelated root.
PROJECT_DIR=$(resolve_project_dir "$HOOK_ENVELOPE")
if [ -z "$PROJECT_DIR" ]; then
	hook_error "$_HOOK" "no project dir (envelope cwd / SILK_PROJECT_DIR / CLAUDE_PROJECT_DIR all unset); skipping"
	emit_noop
	exit 0
fi

case "$PATH_ARG" in
	/*) ABS="$PATH_ARG" ;;
	*)  ABS="${PROJECT_DIR}/${PATH_ARG}" ;;
esac

case "$ABS" in
	"${PROJECT_DIR}/.repos/config.json") exit 0 ;;
	"${PROJECT_DIR}/.repos/"*)
		emit_deny ".repos/** is vendored read-only reference source. Use repos_manage (or savvy repos) to mutate vendored repos; edit .repos/config.json for notes and orientation."
		;;
esac
exit 0

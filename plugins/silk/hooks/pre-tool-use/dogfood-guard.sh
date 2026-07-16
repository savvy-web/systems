#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (matchers: Bash "git push" / "gh pr create" / "gh pr edit";
# the GitKraken MCP equivalents git_push / pull_request_create; the GitHub
# MCP server's create_pull_request / update_pull_request / push_files) --
# deny publishing a branch while THIS repo is "downstream" in an active
# dogfood loop. See skills/dogfood/SKILL.md for the full protocol; this is
# the enforced half of its "no push / no PR while linked" discipline
# (docs/superpowers/specs/2026-07-16-dogfood-mailbox-skill-design.md).
#
# Reads the LAST VALID line of every "${PROJECT_DIR}/.claude/dogfood/*.jsonl"
# journal (JSONL snapshot-lines -- current state is the tail line, per the
# skill's journal contract). Denies when ANY journal's last valid line has
# role:"downstream" and phase != "unlinked" -- that combination means a
# pnpm-workspace.yaml override still points at a sibling checkout's
# file:../../ path, which resolves only on this machine.
#
# This is a TRIPWIRE, not a security boundary -- same posture as
# repos-bash-guard.sh/repos-mcp-guard.sh: best-effort command-string matching,
# not full shell parsing. Fails open, per the spec's explicit posture:
#   - no jq / malformed envelope / non-matching tool -> silent exit 0
#   - ".claude/dogfood/" missing, or no *.jsonl files inside it -> silent exit 0
#   - an unparseable tail line -> walk back to the previous line
#   - a journal with NO valid line at all -> skip that journal (logged via
#     hook_error) -- a corrupt journal must never brick every push in the repo
#
# The upstream role is NOT guarded here -- its branch is expected to go to PR
# mid-loop (the upstream-pr phase); see the skill's discipline section.
#
# No bypass flag. A genuinely wrong deny is corrected by appending a
# `correction` snapshot to the journal (the audit trail), not by routing
# around this hook.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/dogfood-guard"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"

TOOL=$(jq -r '.tool_name // empty' <<< "$HOOK_ENVELOPE")
[ -z "$TOOL" ] && exit 0

# git push, in any of its common shapes: plain, with global flags before the
# subcommand (-C dir, --no-pager, ...), with a value-bearing flag, or with
# remote/branch/--force-style arguments after it. Best-effort, not a full
# shell parse (documented miss, same posture as repos-bash-guard.sh).
GIT_PUSH_RE='(^|[^[:alnum:]_])git[[:space:]]+(-[A-Za-z-]+([[:space:]]+[^[:space:]]+)?[[:space:]]+)*push([[:space:]]|$)'
GH_PR_RE='(^|[^[:alnum:]_])gh[[:space:]]+pr[[:space:]]+(create|edit)([[:space:]]|$)'

applicable=0
case "$TOOL" in
	Bash)
		COMMAND=$(jq -r '.tool_input.command // empty' <<< "$HOOK_ENVELOPE")
		[ -z "$COMMAND" ] && exit 0
		if [[ "$COMMAND" =~ $GIT_PUSH_RE ]] || [[ "$COMMAND" =~ $GH_PR_RE ]]; then
			applicable=1
		fi
		;;
	mcp__gk__*|mcp__gitkraken__*|mcp__GitKraken__*|mcp__github__*|mcp__github-*__*)
		case "$TOOL" in
			mcp__gk__*) OP="${TOOL#mcp__gk__}" ;;
			mcp__gitkraken__*) OP="${TOOL#mcp__gitkraken__}" ;;
			mcp__GitKraken__*) OP="${TOOL#mcp__GitKraken__}" ;;
			mcp__github__*) OP="${TOOL#mcp__github__}" ;;
			mcp__github-*__*)
				REST="${TOOL#mcp__github-}"
				OP="${REST#*__}"
				;;
			*) OP="" ;;
		esac
		case "$OP" in
			git_push|pull_request_create|create_pull_request|update_pull_request|push_files) applicable=1 ;;
		esac
		;;
	*)
		exit 0
		;;
esac

[ "$applicable" -eq 1 ] || exit 0

PROJECT_DIR=$(resolve_project_dir "$HOOK_ENVELOPE")
[ -z "$PROJECT_DIR" ] && exit 0

DOGFOOD_DIR="${PROJECT_DIR}/.claude/dogfood"
[ -d "$DOGFOOD_DIR" ] || exit 0

shopt -s nullglob
journals=("${DOGFOOD_DIR}"/*.jsonl)
shopt -u nullglob
[ "${#journals[@]}" -eq 0 ] && exit 0

for journal in "${journals[@]}"; do
	loop_id="$(basename "$journal" .jsonl)"

	# Walk the file bottom-up (awk reverses it -- portable across the
	# GNU/BSD `tac`-vs-`tail -r` split, and avoids bash4-only mapfile). The
	# first line that survives `jq -e` as a JSON object is the tail's last
	# VALID snapshot, per the journal's corrupt-tail-self-heals contract; an
	# unparseable line is skipped in favor of the one before it.
	last_valid=""
	while IFS= read -r line; do
		[ -z "$line" ] && continue
		if jq -e 'type == "object"' >/dev/null 2>&1 <<< "$line"; then
			last_valid="$line"
			break
		fi
	done < <(awk '{ lines[NR] = $0 } END { for (i = NR; i >= 1; i--) print lines[i] }' "$journal" 2>/dev/null)

	if [ -z "$last_valid" ]; then
		hook_error "$_HOOK" "journal ${journal} has no valid JSONL line; skipping (fail-open)"
		continue
	fi

	role=$(jq -r '.role // empty' <<< "$last_valid")
	phase=$(jq -r '.phase // empty' <<< "$last_valid")

	if [ "$role" = "downstream" ] && [ -n "$phase" ] && [ "$phase" != "unlinked" ]; then
		emit_deny "dogfood loop \"${loop_id}\" is downstream in phase \"${phase}\" -- pushing or opening a PR now risks publishing pnpm-workspace.yaml file:../../ overrides that only resolve on this machine. Run /silk:dogfood --exit to unlink before pushing."
		exit 0
	fi
done

exit 0

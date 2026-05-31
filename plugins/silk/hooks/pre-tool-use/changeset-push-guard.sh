#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: block `git push` from a feature branch when the diff
# against the default branch contains no changeset under .changeset/.
#
# Strategy: fire once per push attempt, not per commit. Surface a clear,
# actionable deny reason that tells the caller exactly how to proceed —
# either create a changeset, or retry with CHANGESETS_SKIP_PUSH_CHECK=1
# prefixed to the same command for branches that genuinely don't need one
# (docs-only, internal refactor, dependency pin within range, etc.).
#
# Fails open: anything ambiguous (no jq, not a git repo, no upstream base
# ref, detached HEAD) emits a no-op and lets the push proceed.

# shellcheck source=../lib/changesets-hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/changesets-hook-output.sh"
# shellcheck source=../lib/changesets-hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/changesets-hook-debug.sh"
# shellcheck source=../lib/source-session-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/source-session-env.sh"

_HOOK="pre-tool-use-push-guard"

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

command=$(jq -r '.tool_input.command // empty' <<< "$input")
if [ -z "$command" ]; then
	emit_noop
	exit 0
fi

# Walk past leading whitespace, an optional leading `env` keyword, and any
# inline `FOO=bar` assignments so commands like
#   CHANGESETS_SKIP_PUSH_CHECK=1 git push ...
#   env CHANGESETS_SKIP_PUSH_CHECK=1 git push ...
# both resolve to the `git push` verb. Track whether the override appeared
# anywhere in the leading prefix chain.
#
# We do not parse env(1) flags (-i, -u, -S, --). A command that uses those
# falls through the `^git push` check below and fails open silently.
trimmed="${command#"${command%%[![:space:]]*}"}"
if [[ "$trimmed" =~ ^env[[:space:]]+(.*) ]]; then
	trimmed="${BASH_REMATCH[1]}"
fi
inline_override=0
while [[ "$trimmed" =~ ^([A-Za-z_][A-Za-z0-9_]*)=([^[:space:]]+)[[:space:]]+(.*) ]]; do
	key="${BASH_REMATCH[1]}"
	val="${BASH_REMATCH[2]}"
	case "$val" in
		\"*\") val="${val#\"}"; val="${val%\"}" ;;
		\'*\') val="${val#\'}"; val="${val%\'}" ;;
	esac
	if [ "$key" = "CHANGESETS_SKIP_PUSH_CHECK" ]; then
		case "$val" in
			1 | true | yes | on | TRUE | YES | ON) inline_override=1 ;;
		esac
	fi
	trimmed="${BASH_REMATCH[3]}"
done

# Only act on `git push ...`. Anything else (including `git push` mentioned
# inside a heredoc string) is out of scope.
if [[ ! "$trimmed" =~ ^git[[:space:]]+push([[:space:]]|$) ]]; then
	emit_noop
	exit 0
fi

# Session-level override: a developer can `export CHANGESETS_SKIP_PUSH_CHECK=1`
# before launching Claude Code to disable the guard for the whole session.
session_override=0
case "${CHANGESETS_SKIP_PUSH_CHECK:-}" in
	1 | true | yes | on | TRUE | YES | ON) session_override=1 ;;
esac

if [ "$inline_override" = "1" ] || [ "$session_override" = "1" ]; then
	emit_noop
	exit 0
fi

project_dir="${CHANGESETS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [ -z "$project_dir" ]; then
	project_dir=$(pwd)
fi

if ! git -C "$project_dir" rev-parse --git-dir &>/dev/null; then
	emit_noop
	exit 0
fi

branch=$(git -C "$project_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
case "$branch" in
	main | master | HEAD | "")
		emit_noop
		exit 0
		;;
	release/* | changeset-release/* | dependabot/* | renovate/* | renovate-*)
		emit_noop
		exit 0
		;;
esac

base_ref=""
for candidate in origin/main origin/master main master; do
	if git -C "$project_dir" rev-parse --verify --quiet "$candidate" &>/dev/null; then
		base_ref="$candidate"
		break
	fi
done

if [ -z "$base_ref" ]; then
	emit_noop
	exit 0
fi

merge_base=$(git -C "$project_dir" merge-base "$base_ref" HEAD 2>/dev/null || echo "")
if [ -z "$merge_base" ]; then
	emit_noop
	exit 0
fi

# Look for any added .md file under .changeset/ on this branch, excluding
# README.md. `--diff-filter=A` catches added entries; if the agent edited
# an existing changeset on this branch it would show up as `M` and still
# represent a release note, so include that too.
changeset_changes=$(git -C "$project_dir" diff --name-only --diff-filter=AM "$merge_base"...HEAD -- ".changeset/" 2>/dev/null \
	| grep -E '\.changeset/[^/]+\.md$' \
	| grep -v -E '\.changeset/README\.md$' \
	|| true)

if [ -n "$changeset_changes" ]; then
	emit_noop
	exit 0
fi

commit_count=$(git -C "$project_dir" rev-list --count "$merge_base"..HEAD 2>/dev/null || echo "0")

reason="<EXTREMELY_IMPORTANT>
Push blocked. Branch '${branch}' has ${commit_count} commit(s) since ${base_ref} but no changeset under .changeset/.

Changesets are this repo's release documentation. A push without one publishes a CHANGELOG entry with no user-visible explanation of what changed.

Pick one path before re-running:

1. The change has user-facing impact (any code in a published package, public API, behavior, bug fix, perf change):
   Run /silk:changeset-create to draft one, commit it, then push again.

2. The change has NO user-facing impact (docs-only, internal refactor, CI/test-only, dependency pin bump within range, or anything covered by the plugin's exclusion rules):
   Re-run the same push prefixed with CHANGESETS_SKIP_PUSH_CHECK=1, for example:

       CHANGESETS_SKIP_PUSH_CHECK=1 ${command}

   The prefix is per-invocation; you do not need to export it. The guard fires once and yields to the override.

Do NOT silence the guard with --no-verify or by editing .changeset/README.md. Either create a real changeset or pass the override on the retry.
</EXTREMELY_IMPORTANT>"

emit_deny "$reason"

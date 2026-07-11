#!/usr/bin/env bash
set -euo pipefail

# Stop hook: when the main agent hands control back, tell the HUMAN if the
# current branch has commits but no changeset. That is all it does.
#
# It does not block, deny, or instruct. It emits a top-level `systemMessage`,
# which the host shows to the user and does NOT inject into the model's context.
# There is deliberately no `decision` and no `additionalContext`: the agent is
# not the audience and is not asked to act.
#
# Why here, and not at push or commit time (savvy-web/systems#274):
#
#   * Deciding whether a change needs a changeset is a HUMAN judgement. The
#     signals a hook can see — "commits exist, no .changeset/*.md" — cannot
#     distinguish a user-facing fix from a docs-only branch, so any hook that
#     BLOCKS on them is guaranteed to be wrong on a large, legitimate class of
#     branches. The old push guard denied those pushes and advertised an env-var
#     bypass as the remedy, which trained agents to disarm a safety mechanism.
#     Enforcement lives in CI on the PR, where the full diff is available and an
#     override is an explicit, reviewable human act.
#
#   * Commit time is too early and too often: the changeset decision needs the
#     whole branch diff, which does not exist at commit 3 of 12, and a subagent
#     making many commits would be nagged on each one.
#
#   * Stop fires once per MAIN-agent turn. SubagentStop is a separate event, so
#     dispatched subagents never trigger this. It is the moment the branch is at
#     rest and the human who owns the decision is the one reading.
#
# Debounced on HEAD: it speaks once when commits land, then stays quiet until
# HEAD moves again. Fails open (silent) on anything ambiguous.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"
# shellcheck source=../lib/source-session-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/source-session-env.sh"

_HOOK="stop/changeset-nudge"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"

session_id=$(jq -r '.session_id // ""' <<< "$HOOK_ENVELOPE")
if [ -n "$session_id" ]; then
	source_session_env "$session_id"
fi

# Opt-out for anyone who does not want the reminder at all.
case "${SILK_SKIP_CHANGESET_NUDGE:-}" in
	1 | true | yes | on | TRUE | YES | ON)
		emit_noop
		exit 0
		;;
esac

project_dir=$(resolve_project_dir "$HOOK_ENVELOPE")
if [ -z "$project_dir" ]; then
	project_dir=$(pwd)
fi

if ! git -C "$project_dir" rev-parse --git-dir >/dev/null 2>&1; then
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
	if git -C "$project_dir" rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
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

commit_count=$(git -C "$project_dir" rev-list --count "$merge_base"..HEAD 2>/dev/null || echo "0")
if [ "$commit_count" = "0" ]; then
	emit_noop
	exit 0
fi

# An added OR modified .changeset/*.md (excluding README.md) counts as present.
changeset_changes=$(git -C "$project_dir" diff --name-only --diff-filter=AM "$merge_base"...HEAD -- ".changeset/" 2>/dev/null \
	| grep -E '\.changeset/[^/]+\.md$' \
	| grep -v -E '\.changeset/README\.md$' \
	|| true)
if [ -n "$changeset_changes" ]; then
	emit_noop
	exit 0
fi

# Debounce on HEAD. Without this the hook would speak on EVERY main-agent turn,
# which is the nagging failure we are trying not to reproduce. Speak once per
# new commit state, then stay quiet until HEAD moves.
head_sha=$(git -C "$project_dir" rev-parse HEAD 2>/dev/null || echo "")
marker=""
if [ -n "$session_id" ] && [ -n "$head_sha" ]; then
	case "$session_id" in
		*/* | *..* | '' | .) ;; # unsafe id — skip the marker, still nudge
		*)
			marker_dir="${HOME}/.claude/session-env/${session_id}"
			marker="${marker_dir}/changeset-nudge.head"
			if [ -f "$marker" ] && [ "$(cat "$marker" 2>/dev/null || true)" = "$head_sha" ]; then
				emit_noop
				exit 0
			fi
			;;
	esac
fi

plural="commits"
[ "$commit_count" = "1" ] && plural="commit"

message="silk: branch '${branch}' has ${commit_count} ${plural} since ${base_ref} and no changeset. If this change is user-facing, run /silk:changeset --create."

if [ -n "$marker" ]; then
	mkdir -p "$(dirname "$marker")" 2>/dev/null || true
	printf '%s' "$head_sha" > "$marker" 2>/dev/null || true
fi

hook_debug "$_HOOK" "nudging: ${branch} @ ${head_sha} (${commit_count} commits, no changeset)"

# Top-level systemMessage: shown to the USER, not injected into the model's
# context. No decision / additionalContext — the turn ends normally.
jq -n --arg m "$message" '{ systemMessage: $m }'

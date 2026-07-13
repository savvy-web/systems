#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook (no matcher -- fires on every session start including
# resume/compact): inject vendored-repos orientation context built from
# .repos/config.json (the Task 1 schema: repos, each with url/ref/purpose and
# optional orientation{layout,keyPaths,startHere}/notes[]).
#
# Contract: reads the SessionStart envelope on stdin; resolves PROJECT_DIR via
# resolve_project_dir (envelope .cwd first -- worktree-correct, see
# savvy-web/systems#274). No .repos/config.json manifest -> emit_noop.
#
# Runs `savvy repos sync --cwd "$PROJECT_DIR"` first, as a best-effort
# side-effect, behind an INTERNAL watchdog (SILK_REPOS_SYNC_TIMEOUT, default
# 6s -- well under this hook's own hooks.json timeout of 10s) so a hung fetch
# can never make the harness kill the whole hook mid-flight. Sync NEVER gates
# the context block: the <vendored_repos> block always renders from the
# manifest, even when sync failed or was killed by the watchdog -- that is
# exactly the offline/degraded case where the agent most needs the warning
# that content may be stale.
#
# The block is budgeted at 2000 chars total. Per-repo blocks accumulate in
# manifest order; once the next block would push the running total over
# budget, that repo and every remaining repo render only the one-line
# overflow form: `- <name> — <purpose> (details: repos_inspect mode:"config")`.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="session-start/repos-orientation"

# Fail open without jq -- the whole block is built with jq.
if ! command -v jq &>/dev/null; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"

PROJECT_DIR=$(resolve_project_dir "$HOOK_ENVELOPE")
if [ -z "$PROJECT_DIR" ]; then
	hook_error "$_HOOK" "no project dir (envelope cwd / SILK_PROJECT_DIR / CLAUDE_PROJECT_DIR all unset); skipping"
	emit_noop
	exit 0
fi

MANIFEST="${PROJECT_DIR}/.repos/config.json"

# Step 1: no manifest -> nothing to orient on. This is the common case (most
# sessions are not in a repo that vendors reference repos), so stay silent.
if [ ! -f "$MANIFEST" ]; then
	emit_noop
	exit 0
fi

# Fail open on a corrupt/unreadable manifest too -- same posture as a missing
# one, since there is nothing valid to render either way.
if ! jq -e '.repos' "$MANIFEST" >/dev/null 2>&1; then
	hook_error "$_HOOK" "manifest at ${MANIFEST} is invalid or unreadable; skipping"
	emit_noop
	exit 0
fi

# Step 2: run `savvy repos sync` behind an internal watchdog. SYNC_OK tracks
# the outcome for the header line below; it never blocks context emission.
RUNNER=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-cli.sh")

SYNC_OK=1
run_sync() {
	$RUNNER savvy repos sync --cwd "$PROJECT_DIR" >/dev/null 2>&1 &
	local pid=$!
	( sleep "${SILK_REPOS_SYNC_TIMEOUT:-6}" && kill "$pid" 2>/dev/null ) &
	local watchdog=$!
	if ! wait "$pid"; then SYNC_OK=0; fi
	kill "$watchdog" 2>/dev/null || true
}
run_sync

# Step 3: build the context block from the manifest -- unconditionally,
# regardless of SYNC_OK. One compact JSON record per repo (full + overflow
# renderings); a bash loop below accumulates full blocks in manifest order
# until the 2000-char budget would be exceeded, then switches to the one-line
# overflow form for that repo and everything after it.
RECORDS=$(jq -c '
	(.repos // {}) | to_entries[] |
	{
		full: (
			"- " + .key + " @ " + .value.ref + " — " + .value.purpose
			+ (if ((.value.orientation.layout // "") | length) > 0
				then "\n  layout: " + .value.orientation.layout else "" end)
			+ (if ((.value.orientation.startHere // "") | length) > 0
				then "\n  startHere: " + .value.orientation.startHere else "" end)
			+ ((.value.orientation.keyPaths // {}) | to_entries
				| map("\n  keyPath " + .key + ": " + .value) | join(""))
			+ ((.value.notes // []) | map("\n  note (" + .id + ", " + .ref + "): " + .note) | join(""))
		),
		overflow: ("- " + .key + " — " + .value.purpose + " (details: repos_inspect mode:\"config\")")
	}
' "$MANIFEST")

BUDGET=2000
BODY=""
TOTAL=0
OVERFLOWED=0
while IFS= read -r record; do
	[ -z "$record" ] && continue
	full=$(jq -r '.full' <<< "$record")
	overflow=$(jq -r '.overflow' <<< "$record")
	if [ "$OVERFLOWED" -eq 0 ] && [ $((TOTAL + ${#full} + 1)) -le "$BUDGET" ]; then
		BODY="${BODY}${full}"$'\n'
		TOTAL=$((TOTAL + ${#full} + 1))
	else
		OVERFLOWED=1
		BODY="${BODY}${overflow}"$'\n'
		TOTAL=$((TOTAL + ${#overflow} + 1))
	fi
done <<< "$RECORDS"

# Step 4: header (contract line + sync outcome), then the per-repo body.
CONTRACT_LINE=".repos/** is read-only vendored reference source; repos_inspect to look, repos_manage to act"
if [ "$SYNC_OK" -eq 1 ]; then
	SYNC_LINE="synced"
else
	SYNC_LINE="sync failed or timed out — content may be missing; run: savvy repos sync"
fi

CONTEXT=$(cat <<CONTEXT
<vendored_repos>
${CONTRACT_LINE}
${SYNC_LINE}

${BODY}</vendored_repos>
CONTEXT
)

# Step 5.
emit_context "SessionStart" "$CONTEXT"

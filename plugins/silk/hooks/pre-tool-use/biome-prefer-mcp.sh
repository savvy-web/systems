#!/usr/bin/env bash
set -euo pipefail

# PreToolUse (matcher: Bash) — when the agent runs Biome via Bash, directly or
# through a package.json script, nudge it toward mcp__plugin_silk_savvy-mcp__biome_check.
# "Directly" means biome sits in COMMAND POSITION (see the matcher below) --
# not merely mentioned as an argument or inside a quoted string elsewhere in
# the command (savvy-web/systems#248).
# NEVER blocks: emits additionalContext only (no permissionDecision), so the
# command always proceeds and the escape hatch is preserved. Nudges at most once
# per session.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

_HOOK="pre-tool-use/biome-prefer-mcp"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

ENVELOPE=$(cat)

# Subagent guard — placed before any biome-detection work so subagent calls
# short-circuit cheaply. `agent_id` is present in the envelope only when this
# hook fires inside a dispatched subagent call (see
# https://code.claude.com/docs/en/hooks — "How agent hooks work"). Subagents
# run with an explicit, curated `tools:` allowlist, so a session-level
# "prefer mcp__plugin_silk_savvy-mcp__biome_check" reminder is either
# redundant (the subagent already lists the tool) or a dead end (it doesn't
# have it, gets "No such tool available", falls back to Bash biome, and this
# very hook fires again — a loop with no way out). No current silk agent
# lists biome_check in its allowlist, so suppressing the nudge for every
# subagent call is strictly correct today; the main-session nudge (no
# `agent_id`, the tool is genuinely available) is unaffected. This check
# runs before the once-per-session marker is touched, so a subagent's Bash
# biome call does not consume the main thread's one-time nudge.
AGENT_ID=$(echo "$ENVELOPE" | jq -r '.agent_id // empty')
if [ -n "$AGENT_ID" ]; then
	emit_noop
	exit 0
fi

COMMAND=$(echo "$ENVELOPE" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && { emit_noop; exit 0; }

is_biome=0

# 1. Direct invocation: biome sits in COMMAND POSITION in at least one
#    control-operator-delimited segment of $COMMAND -- the first token of the
#    whole command, or of a sub-command following `;`, `|`, `&`/`&&`, `(`, or
#    a newline, optionally after peeling off a leading `env`/inline
#    `VAR=value` assignment and/or a runner keyword (`exec`, `npx`, `bunx`,
#    or `pnpm`/`npm`/`yarn`/`bun` optionally followed by `run`), and
#    optionally path-prefixed (`/abs/path/biome`, `./node_modules/.bin/biome`).
#
#    This deliberately does NOT match "biome" appearing later in a command --
#    as a bare argument (`grep biome file`) or inside a quoted string (a `gh
#    issue create --body "... biome ..."`, savvy-web/systems#248's repro).
#    Segmentation tracks single/double-quote state so a control-operator
#    character INSIDE a quoted argument is not mistaken for a sub-command
#    boundary. Not a full shell parser: no backslash-escape awareness, and
#    `$(...)`/backtick substitutions are not descended into -- acceptable for
#    a best-effort nudge (worst case: a substitution invoking biome is
#    missed, a false negative, never a false positive).

# Splits "$1" into sub-command segments (appended to the global
# BIOME_SEGMENTS array so embedded newlines inside a quoted argument stay
# inert -- they are not re-split by a text round-trip through a subshell).
_biome_split_segments() {
	local cmd="$1"
	local seg="" ch
	local -i i len in_s=0 in_d=0
	len=${#cmd}
	for (( i = 0; i < len; i++ )); do
		ch="${cmd:i:1}"
		if [ "$in_s" -eq 0 ] && [ "$in_d" -eq 0 ]; then
			case "$ch" in
				\') in_s=1; seg+="$ch" ;;
				\") in_d=1; seg+="$ch" ;;
				';' | '|' | '&' | '(' | $'\n')
					BIOME_SEGMENTS+=("$seg")
					seg=""
					;;
				*) seg+="$ch" ;;
			esac
		else
			seg+="$ch"
			[ "$in_s" -eq 1 ] && [ "$ch" = "'" ] && in_s=0
			[ "$in_d" -eq 1 ] && [ "$ch" = '"' ] && in_d=0
		fi
	done
	BIOME_SEGMENTS+=("$seg")
}

# True (exit 0) when "$1", a single segment, invokes biome in command
# position.
_biome_segment_invokes_biome() {
	local seg="$1"
	seg="${seg#"${seg%%[![:space:]]*}"}"
	[ -z "$seg" ] && return 1

	# Peel off, in a loop, anything preceding the actual invoked binary.
	local changed=1
	while [ "$changed" -eq 1 ]; do
		changed=0
		if [[ "$seg" =~ ^env[[:space:]]+(.*) ]]; then
			seg="${BASH_REMATCH[1]}"
			changed=1
			continue
		fi
		if [[ "$seg" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(\"[^\"]*\"|\'[^\']*\'|[^[:space:]]*)[[:space:]]+(.*) ]]; then
			seg="${BASH_REMATCH[3]}"
			changed=1
			continue
		fi
		if [[ "$seg" =~ ^(exec|npx|bunx)[[:space:]]+(.*) ]]; then
			seg="${BASH_REMATCH[2]}"
			changed=1
			continue
		fi
		if [[ "$seg" =~ ^(pnpm|npm|yarn|bun)[[:space:]]+run[[:space:]]+(.*) ]]; then
			seg="${BASH_REMATCH[2]}"
			changed=1
			continue
		fi
		if [[ "$seg" =~ ^(pnpm|npm|yarn|bun)[[:space:]]+(.*) ]]; then
			seg="${BASH_REMATCH[2]}"
			changed=1
			continue
		fi
	done

	[[ "$seg" =~ ^([^[:space:]]*/)?biome([[:space:]]|$) ]]
}

BIOME_SEGMENTS=()
_biome_split_segments "$COMMAND"
for _segment in "${BIOME_SEGMENTS[@]}"; do
	if _biome_segment_invokes_biome "$_segment"; then
		is_biome=1
		break
	fi
done

# 2. Indirect: a package-manager/turbo script whose package.json body mentions biome.
#    Best-effort: only the nearest root package.json is consulted, so workspace-
#    scoped invocations (`pnpm --filter <pkg> lint`, `pnpm -C <dir> run lint`)
#    whose script lives in a sub-package may be missed. Acceptable for a nudge.
if [ "$is_biome" -eq 0 ]; then
	script=$(echo "$COMMAND" \
		| grep -Eo '(pnpm|npm|yarn|bun|turbo)[[:space:]]+(run[[:space:]]+)?[A-Za-z0-9:_-]+' 2>/dev/null \
		| head -n1 | awk '{ print $NF }' || true)
	if [ -n "${script:-}" ]; then
		root="${CLAUDE_PROJECT_DIR:-$(echo "$ENVELOPE" | jq -r '.cwd // empty')}"
		root="${root:-$(pwd)}"
		if [ -f "$root/package.json" ]; then
			body=$(jq -r --arg s "$script" '.scripts[$s] // empty' "$root/package.json" 2>/dev/null || true)
			if echo "${body:-}" | grep -q 'biome'; then
				is_biome=1
			fi
		fi
	fi
fi

[ "$is_biome" -eq 0 ] && { emit_noop; exit 0; }

# Nag avoidance: nudge once per session (keyed on the envelope session_id).
# Fall back to a fixed key when session_id is absent so the once-per invariant
# still holds rather than nudging on every Biome invocation.
SESSION_ID=$(echo "$ENVELOPE" | jq -r '.session_id // empty')
# Sanitize: session_id is untrusted envelope input. A value containing a path
# separator or `..` could escape ~/.claude/session-env/; fall back to the fixed
# key in that case so the marker write stays inside the intended directory.
case "$SESSION_ID" in
	*/* | *..*) SESSION_ID="" ;;
esac
marker_dir="${HOME}/.claude/session-env/${SESSION_ID:-_no-session}"
marker="${marker_dir}/biome-prefer-mcp.nudged"
if [ -f "$marker" ]; then
	emit_noop
	exit 0
fi
mkdir -p "$marker_dir" 2>/dev/null || true
: > "$marker" 2>/dev/null || true

NUDGE='<important>
You are about to run Biome via Bash. The preferred path is the mcp__plugin_silk_savvy-mcp__biome_check MCP tool: it returns typed, structured diagnostics and can apply safe or unsafe fixes via the write/unsafe flags.

Use the Bash biome command only when:
  - You already tried biome_check and it errored or is unavailable
  - You need a Biome flag that biome_check does not expose
  - You are inside a turbo/pnpm script that resolves its own biome binary

This nudge fires once per session and never blocks.
</important>'

emit_context "PreToolUse" "$NUDGE"
exit 0

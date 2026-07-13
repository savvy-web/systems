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
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/biome-prefer-mcp"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"
ENVELOPE="$HOOK_ENVELOPE"

# Subagent guard — placed before any biome-detection work so subagent calls
# short-circuit cheaply. `agent_id` is present in the envelope only when this
# hook fires inside a dispatched subagent call (see
# https://code.claude.com/docs/en/hooks — "How agent hooks work"). Subagents
# run with an explicit, curated `tools:` allowlist, so a session-level
# "prefer mcp__plugin_silk_savvy-mcp__biome_check" reminder is either
# redundant (the subagent already lists the tool — tsdoctor and turborepo
# do) or a dead end (it doesn't have it — changeset-manager doesn't — gets
# "No such tool available", falls back to Bash biome, and this very hook
# fires again — a loop with no way out). The hook cannot tell which case it
# is in, so it suppresses for every subagent call; the main-session nudge
# (no `agent_id`, the tool is genuinely available) is unaffected. This check
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
#
# Performance note (savvy-web/systems#250 CodeRabbit finding): this used to
# scan $cmd one bash character at a time (`ch="${cmd:i:1}"`) and rebuild each
# segment by repeated `seg+="$ch"` appends. Both parts are O(n^2) in this
# bash: `${cmd:i:1}` itself costs ~O(i) per call (confirmed empirically --
# extracting a single char near the end of a long string is as expensive as
# a full scan from the start), so a for-loop over every offset is quadratic
# even before counting the string-copy cost of `+=`. This hook fires on
# every Bash tool call, and multi-KB heredoc commands (writing files via the
# Bash tool) made the quadratic cost real -- a 200KB command containing
# "biome" took tens of seconds.
#
# Fix: hand the scan to awk, whose split()-into-char-array + substr() are
# genuinely O(1)/O(n) regardless of offset (also confirmed empirically).
# `split($0, arr, "")` turns the record into a character array in one O(n)
# pass; the loop below only ever *compares* arr[i] (O(1) per element) and
# calls substr() ONCE per segment boundary to slice it out -- so the sum of
# every slice is bounded by len(cmd), same O(n) shape as the bash rewrite
# would have been if bash's own indexing were O(1).
#
# RS is set to "\001" (SOH), not "\0": this awk (and several others) treats
# RS="\0" as equivalent to RS="" (paragraph mode) internally, which silently
# strips a leading run of newlines and splits the record on blank lines --
# both would corrupt a multi-line heredoc $COMMAND. "\001" is a control byte
# that cannot appear in a bash command string typed or generated by the
# agent, so it is safe as a real "read the whole stdin as one record"
# sentinel. Quote-state tracking (in_s/in_d) and the exact boundary
# characters (`;`, `|`, `&`, `(`, newline) are unchanged from the bash
# version: a control-operator character inside a quoted argument is still
# not treated as a boundary, and the quote characters themselves still end
# up inside whichever segment they fall in (never split out on their own).
_biome_split_segments() {
	local cmd="$1"
	# Guard the empty-string edge case explicitly rather than relying on
	# awk's (implementation-varying) behavior for zero-byte stdin, so the
	# "always append a final segment" invariant holds even when unused today
	# (the caller never invokes this with an empty $cmd -- COMMAND is
	# checked non-empty, and the *biome* substring guard runs first).
	if [ -z "$cmd" ]; then
		BIOME_SEGMENTS+=("")
		return 0
	fi
	local _seg
	while IFS= read -r -d '' _seg; do
		BIOME_SEGMENTS+=("$_seg")
	done < <(
		printf '%s' "$cmd" | awk '
			BEGIN { RS = "\001"; in_s = 0; in_d = 0 }
			{
				n = split($0, arr, "")
				start = 1
				for (i = 1; i <= n; i++) {
					ch = arr[i]
					if (in_s == 0 && in_d == 0) {
						if (ch == "\047") { in_s = 1 }
						else if (ch == "\"") { in_d = 1 }
						else if (ch == ";" || ch == "|" || ch == "&" || ch == "(" || ch == "\n") {
							printf "%s%c", substr($0, start, i - start), 0
							start = i + 1
						}
					} else {
						if (in_s == 1 && ch == "\047") { in_s = 0 }
						if (in_d == 1 && ch == "\"") { in_d = 0 }
					}
				}
				printf "%s%c", substr($0, start), 0
			}
		'
	)
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

# Cheap early short-circuit (savvy-web/systems#250 CodeRabbit finding): any
# actual direct invocation -- plain, path-prefixed, or peeled through env/
# VAR=/runner-keyword -- necessarily contains the literal substring "biome"
# somewhere in $COMMAND. So a single substring test lets the overwhelmingly
# common case (a Bash command that never mentions biome at all, including
# large heredocs) skip the quote-aware splitter entirely in O(n) with no
# array/loop overhead. This only guards the DIRECT-match branch below --
# it must NOT skip the INDIRECT package-script branch (which matches on a
# package-manager/turbo RUNNER command, not on the literal word "biome"
# appearing in $COMMAND) or the subagent agent_id guard (which already ran
# and returned above, before any of this).
#
# Fail open if awk isn't installed (mirrors the jq guard above): the direct-
# match branch is skipped, but the indirect package-script branch below still
# runs, so a package.json script that shells out to biome is still caught.
if [[ "$COMMAND" == *biome* ]] && command -v awk >/dev/null 2>&1; then
	BIOME_SEGMENTS=()
	_biome_split_segments "$COMMAND"
	for _segment in "${BIOME_SEGMENTS[@]}"; do
		if _biome_segment_invokes_biome "$_segment"; then
			is_biome=1
			break
		fi
	done
elif [[ "$COMMAND" == *biome* ]]; then
	hook_error "$_HOOK" "awk not found; skipping direct-match detection"
fi

# 2. Indirect: a package-manager/turbo script whose package.json body mentions biome.
#    Best-effort: only the nearest root package.json is consulted, so workspace-
#    scoped invocations (`pnpm --filter <pkg> lint`, `pnpm -C <dir> run lint`)
#    whose script lives in a sub-package may be missed. Acceptable for a nudge.
if [ "$is_biome" -eq 0 ]; then
	script=$(echo "$COMMAND" \
		| grep -Eo '(pnpm|npm|yarn|bun|turbo)[[:space:]]+(run[[:space:]]+)?[A-Za-z0-9:_-]+' 2>/dev/null \
		| head -n1 | awk '{ print $NF }' || true)
	if [ -n "${script:-}" ]; then
		root=$(resolve_project_dir "$ENVELOPE")
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

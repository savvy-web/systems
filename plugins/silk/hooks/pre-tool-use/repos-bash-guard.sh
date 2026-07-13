#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (matcher: Bash) -- deny shell commands whose COMMAND
# string visibly writes into "${PROJECT_DIR}/.repos/**" (vendored, read-only
# reference source). ".repos/config.json" is host-repo content and stays
# hand-editable.
#
# This is a TRIPWIRE, not a security boundary. The precise leg of this
# defense is repos-fs-guard.sh, which resolves Write/Edit/NotebookEdit
# tool_input paths against the project dir. This script only pattern-
# matches $COMMAND itself and deliberately does NOT attempt full shell
# parsing -- accepted, documented misses:
#   - a `cd .repos/x` in an EARLIER Bash call, then a later bare relative
#     write whose own COMMAND string never mentions ".repos"
#   - command substitution / variable indirection building the target path
#     at runtime ($(echo .repos)/x, TARGET=".repos/x"; ...; > "$TARGET")
#   - exotic quoting/escaping that slips past the regexes below
# Drift from any of these is detectable via repos_inspect and recoverable
# via `savvy repos sync` -- see .claude/design/systems (repos spec) for the
# tripwire rationale.
#
# Unlike biome-prefer-mcp.sh, this hook does NOT exempt subagent calls -- a
# deny here should hold inside a subagent's Bash tool call too.
#
# Fails open: no jq, a malformed envelope, or a non-Bash tool_name all fall
# through to a silent exit 0.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/repos-bash-guard"
READ_OPS_FILE="${CLAUDE_PLUGIN_ROOT}/hooks/lib/repos-git-read-ops.txt"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"

TOOL=$(jq -r '.tool_name // empty' <<< "$HOOK_ENVELOPE")
[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(jq -r '.tool_input.command // empty' <<< "$HOOK_ENVELOPE")
[ -z "$COMMAND" ] && exit 0

# Cheap early-out (mirrors biome-prefer-mcp.sh's *biome* substring guard):
# every branch below only fires when ".repos" appears literally in the
# command string.
[[ "$COMMAND" != *.repos* ]] && exit 0

# --- Git leg -------------------------------------------------------------
# Only fires when git is explicitly pointed at a tree under .repos/ via -C,
# --git-dir=, or --work-tree=. A command that merely mentions .repos as a
# pathspec (`git log -- .repos/x` run from elsewhere) falls through to the
# non-git leg below.
GIT_REPOS_RE='(^|[^[:alnum:]_])git[[:space:]].*(-C[[:space:]]+[^[:space:]]*\.repos/|--git-dir=[^[:space:]]*/\.repos/|--work-tree=[^[:space:]]*/\.repos/)'
if [[ "$COMMAND" =~ $GIT_REPOS_RE ]]; then
	SUBCOMMAND=""
	SUBCOMMAND_RE='git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+|--git-dir=[^[:space:]]+[[:space:]]+|--work-tree=[^[:space:]]+[[:space:]]+)*([a-zA-Z-]+)'
	if [[ "$COMMAND" =~ $SUBCOMMAND_RE ]]; then
		SUBCOMMAND="${BASH_REMATCH[2]}"
	fi
	if [ -z "$SUBCOMMAND" ]; then
		# Matched "git targets .repos" but couldn't confidently extract a
		# subcommand -- fail open rather than deny on ambiguity.
		hook_error "$_HOOK" "git-targets-.repos matched but subcommand extraction failed; skipping: $COMMAND"
		exit 0
	fi
	if grep -Fxq "$SUBCOMMAND" "$READ_OPS_FILE" 2>/dev/null; then
		exit 0
	fi
	emit_deny "git writes inside .repos/** are denied; re-pin via repos_manage (action: pin)."
	exit 0
fi

# --- Non-git leg -----------------------------------------------------------
# Write-shaped patterns: redirection (> / >>), tee, sed -i, cp, mv, rm,
# patch, dd of=. ".repos/config.json" is the one hand-editable exception.
# Reads (cat, grep, rg, ls, or a plain mention with none of these shapes)
# fall through silently.
#
# sed -i detection: widened to "sed appears as a command" AND "an -i-shaped
# flag (-i, -ni, --in-place, ...) appears anywhere in the command", rather
# than requiring the flag immediately after `sed` -- `sed -e 's/a/b/' -i
# .repos/x` (flag reordered) is caught too. Still best-effort: a flag value
# that happens to look like `-i` (e.g. inside a quoted script argument) can
# false-positive; accepted per the tripwire posture (over-denial only costs
# a re-pin, never corrupts state).
is_write_shape=0
[[ "$COMMAND" =~ \>+[[:space:]]*[^[:space:]]*\.repos/ ]] && is_write_shape=1
[[ "$COMMAND" =~ (^|[^[:alnum:]_])tee([[:space:]]|$) ]] && is_write_shape=1
if [[ "$COMMAND" =~ (^|[^[:alnum:]_])sed([[:space:]]|$) ]] \
	&& [[ "$COMMAND" =~ (^|[[:space:]])(-[A-Za-z]*i|--in-place)([[:space:]]|$) ]]; then
	is_write_shape=1
fi
[[ "$COMMAND" =~ (^|[^[:alnum:]_])cp([[:space:]]|$) ]] && is_write_shape=1
[[ "$COMMAND" =~ (^|[^[:alnum:]_])mv([[:space:]]|$) ]] && is_write_shape=1
[[ "$COMMAND" =~ (^|[^[:alnum:]_])rm([[:space:]]|$) ]] && is_write_shape=1
[[ "$COMMAND" =~ (^|[^[:alnum:]_])patch([[:space:]]|$) ]] && is_write_shape=1
[[ "$COMMAND" =~ dd[[:space:]].*of= ]] && is_write_shape=1

if [ "$is_write_shape" -eq 1 ]; then
	# Exact-match the config.json exemption: word-split $COMMAND (best-
	# effort, not quote-aware -- consistent with the rest of this script)
	# and, for every token that mentions ".repos/", peel off a directly-
	# glued redirect operator (">"/">>"), dd's "of=", and a single pair of
	# surrounding quotes, then compare what's left EXACTLY to
	# ".repos/config.json". A previous version stripped that substring out
	# of $COMMAND wholesale, which wrongly cleared adjacent-filename writes
	# like ".repos/config.json.bak" (the strip left ".bak", no ".repos/"
	# remained, so the deny below never fired) -- fixed by requiring an
	# exact token match instead, mirroring repos-fs-guard.sh's exact case
	# match on the resolved path.
	deny=0
	for tok in $COMMAND; do
		[[ "$tok" == *.repos/* ]] || continue
		target="$tok"
		while [[ "$target" == ">"* ]]; do target="${target#>}"; done
		target="${target#of=}"
		target="${target%\"}"; target="${target#\"}"
		target="${target%\'}"; target="${target#\'}"
		if [ "$target" != ".repos/config.json" ]; then
			deny=1
		fi
	done
	if [ "$deny" -eq 1 ]; then
		emit_deny "writes inside .repos/** are denied; use repos_manage (or savvy repos) to mutate vendored repos, or edit .repos/config.json directly for notes and orientation."
		exit 0
	fi
fi

exit 0

# hook-env.sh — shared stdin-envelope and working-directory resolution for the
# silk plugin hooks.
#
# Source from a hook script, AFTER hook-output.sh and hook-debug.sh (this file
# calls emit_noop and hook_error):
#   . "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
#   . "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
#   . "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

# read_envelope_or_noop <hook-name> — read the hook payload from stdin into the
# global HOOK_ENVELOPE. If stdin is not valid JSON, emit a no-op and exit 0.
#
# Every hook already fails open when jq is MISSING; without this, invalid JSON
# on stdin instead makes the first `var=$(jq ...)` fail under `set -euo
# pipefail`, aborting the hook with jq's exit 5 and empty stdout. That is
# fail-open-ish by accident for PreToolUse but noisy in the logs and
# inconsistent with the deliberate emit_noop everywhere else.
#
# MUST be called at the top level of the hook, never inside a command
# substitution: the `exit 0` below has to terminate the hook, and inside `$(...)`
# it would only terminate the subshell — the no-op JSON would then be captured
# as the envelope instead of reaching stdout. Hence the global rather than an
# echoed return value.
read_envelope_or_noop() {
	local hook_name="${1:-hook}"
	HOOK_ENVELOPE=$(cat)
	# `jq -e .` exits non-zero for a parse error, for `null`, and for empty
	# input — all of which are "nothing actionable here", so all no-op.
	if ! jq -e . >/dev/null 2>&1 <<< "$HOOK_ENVELOPE"; then
		hook_error "$hook_name" "malformed or empty JSON on stdin; skipping"
		emit_noop
		exit 0
	fi
}

# resolve_project_dir <envelope> — echo the working tree that the intercepted
# tool call is actually operating in, or the empty string if it cannot be
# determined. Callers decide what to do with empty (fail open, or fall back to
# pwd) — this helper never guesses.
#
# Precedence:
#   1. envelope .cwd      — the cwd of the tool call being intercepted.
#   2. SILK_PROJECT_DIR   — session propagation of the project root (below).
#   3. CLAUDE_PROJECT_DIR — the session's project root.
#
# The envelope's cwd outranks BOTH env vars, and that ordering is the whole point
# of this helper. CLAUDE_PROJECT_DIR is fixed to the PRIMARY checkout for the
# entire session and does not track the directory a given tool call runs in. When
# an agent works in a git worktree — now an ordinary workflow — the two are
# different trees, on different branches, at different commits, so a hook that
# reasons about git state from CLAUDE_PROJECT_DIR is inspecting a tree with no
# relationship to the call it is guarding (savvy-web/systems#274). Only .cwd
# follows the worktree.
#
# SILK_PROJECT_DIR is NOT a user-facing override despite its name: SessionStart's
# orientation.sh derives it from CLAUDE_PROJECT_DIR and writes it to the
# per-session env file that reader hooks source. It is therefore the same value
# with the same defect and must rank BELOW .cwd — ranking it above (as an
# "operator override") would silently reinstate the primary-checkout bug in every
# real session, since the env file is always present.
resolve_project_dir() {
	local envelope="${1:-}"
	local cwd=""
	if [ -n "$envelope" ] && command -v jq >/dev/null 2>&1; then
		cwd=$(jq -r '.cwd // empty' <<< "$envelope" 2>/dev/null || true)
	fi
	printf '%s' "${cwd:-${SILK_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}}"
}

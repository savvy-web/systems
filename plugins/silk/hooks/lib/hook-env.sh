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
# orientation.sh resolves it through THIS helper and writes it to the per-session
# env file that reader hooks source. It therefore carries whatever the producer
# resolved and must rank BELOW .cwd — ranking it above (as an "operator override")
# would silently reinstate the primary-checkout bug in every real session, since
# the env file is always present.
resolve_project_dir() {
	local envelope="${1:-}"
	local cwd=""
	if [ -n "$envelope" ] && command -v jq >/dev/null 2>&1; then
		cwd=$(jq -r '.cwd // empty' <<< "$envelope" 2>/dev/null || true)
	fi
	printf '%s' "${cwd:-${SILK_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}}"
}

# detect_package_manager <project-dir> — echo the package manager for the given
# project root: pnpm | yarn | bun | npm.
#
# Resolution order, first hit wins:
#   1. package.json "packageManager" field (the corepack declaration).
#   2. A lockfile: pnpm-lock.yaml, then yarn.lock, then bun.lock.
#   3. npm.
#
# FAILS OPEN TO npm at every step: an empty or nonexistent <project-dir>, an
# absent or unreadable package.json, a missing jq, or a malformed manifest all
# land on npm rather than aborting. A SessionStart hook cannot block, and a
# reader hook that guesses the wrong runner degrades gracefully (`npx --no --`
# simply fails to find the CLI) — where an abort would take the whole hook down.
#
# Single source of truth for the SILK_PACKAGE_MANAGER export contract: the
# SessionStart producer (session-start/orientation.sh) writes what this returns,
# and every consumer reads it back from the per-session env file. Both SessionStart
# hooks previously carried private near-duplicate copies of this logic that had
# drifted apart in their project-dir guards (savvy-web/systems#289 follow-up).
detect_package_manager() {
	local root="${1:-}"

	if [ -z "$root" ] || [ ! -d "$root" ]; then
		printf 'npm'
		return
	fi

	if [ -f "${root}/package.json" ] && command -v jq >/dev/null 2>&1; then
		local pm
		pm=$(jq -r '.packageManager // empty' "${root}/package.json" 2>/dev/null | cut -d'@' -f1 || true)
		if [ -n "$pm" ]; then
			printf '%s' "$pm"
			return
		fi
	fi

	if [ -f "${root}/pnpm-lock.yaml" ]; then
		printf 'pnpm'
	elif [ -f "${root}/yarn.lock" ]; then
		printf 'yarn'
	elif [ -f "${root}/bun.lock" ]; then
		printf 'bun'
	else
		printf 'npm'
	fi
}

# package_manager_exec <package-manager> — echo the runner prefix that invokes a
# workspace-local binary with that package manager. Call sites append the binary
# and its args, e.g.: "$(package_manager_exec pnpm) savvy changeset".
#
# Unknown or empty input falls open to the npm form, matching
# detect_package_manager's posture.
package_manager_exec() {
	case "${1:-}" in
		pnpm) printf 'pnpm exec' ;;
		yarn) printf 'yarn exec' ;;
		bun) printf 'bunx' ;;
		*) printf 'npx --no --' ;;
	esac
}

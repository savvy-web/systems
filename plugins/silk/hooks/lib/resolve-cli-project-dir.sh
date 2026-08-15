# resolve-cli-project-dir.sh — canonical repo-root resolution for silk's
# STANDALONE skill/CLI scripts (skills/commit-create/scripts/commit.sh,
# validate-message.sh, skills/changeset/scripts/list.sh, ...).
#
# These are plain CLI scripts, not hooks: there is no JSON envelope on
# stdin, so the caller's cwd is the only first-class signal they get. This
# is deliberately a SEPARATE helper from hooks/lib/hook-env.sh's
# resolve_project_dir, which trusts an envelope `.cwd` the host already sets
# to the intercepted tool call's real working tree — that trust has no
# equivalent here, and this file's cwd-first / worktree-aware / refuse-on-
# genuine-conflict logic does not apply to hooks.
#
# Source from a skill script:
#   . "${CLAUDE_PLUGIN_ROOT}/hooks/lib/resolve-cli-project-dir.sh"
#   PROJECT_DIR=$(resolve_cli_project_dir) || exit 1
#
# Contract (savvy-web/systems#474, #434, #418 — one root-cause family: an
# inherited, stale SILK_PROJECT_DIR/CLAUDE_PROJECT_DIR silently outranking
# the caller's actual working tree):
#
#   1. `git -C "$PWD" rev-parse --show-toplevel` is the PRIMARY authority.
#      Inside a linked git worktree this returns the WORKTREE root — that is
#      correct, and is where a commit belongs; this helper never resolves
#      through to the main checkout.
#
#   2. SILK_PROJECT_DIR, if set, is an EXPLICIT, deliberate override: it
#      always wins over cwd, so an agent can still target another tree on
#      purpose (the documented remedy in #418/#434). A one-line NOTICE goes
#      to stderr whenever it overrides a differing cwd, so the override is
#      never silent — the exact "near-miss" gap #474 flagged.
#
#   3. CLAUDE_PROJECT_DIR is NOT an override — it is the host's pin to the
#      session's PRIMARY checkout for the whole session (see
#      hooks/lib/hook-env.sh's header comment), and is EXPECTED to differ
#      from cwd in the single most common case this fixes: a
#      worktree-isolated agent. That disagreement is IGNORED whenever cwd
#      and CLAUDE_PROJECT_DIR are worktrees of the SAME repository (a shared
#      `git rev-parse --git-common-dir`) — cwd wins silently, with no notice
#      and no refusal, because nothing is actually wrong.
#
#   4. A CLAUDE_PROJECT_DIR naming a genuinely DIFFERENT repository (no
#      shared git-common-dir with cwd — the cross-repo-agent case in #418,
#      or a stale value left over from unrelated earlier work per #474) is a
#      real, actionable disagreement: REFUSE rather than guess, naming both
#      paths on stderr, so a silent wrong-repo commit is impossible. A
#      CLAUDE_PROJECT_DIR that cannot be resolved as a git repo at all (unset,
#      missing, not a checkout) cannot be proven to disagree, so it is
#      treated the same as rule 3 — ignored, cwd wins.
#
#   5. Outside any git repository (cwd resolution itself fails), the env
#      vars become the fallback chain: SILK_PROJECT_DIR (already handled by
#      rule 2, unconditionally) → CLAUDE_PROJECT_DIR → $PWD.

# _physical_path <dir> — echo <dir> with symlinks resolved (`pwd -P`), or
# <dir> unchanged if it is not a real, accessible directory. Load-bearing on
# macOS, where `/tmp` and `/var` are themselves symlinks into `/private/...`:
# `git rev-parse` canonicalizes some outputs (e.g. a linked worktree's
# `--show-toplevel`) but not others (e.g. `--git-common-dir` resolved from a
# non-canonical `-C` argument), so comparing raw strings across two git
# invocations can read the SAME physical directory as two different ones.
# `cd + pwd -P` is used over `realpath`/`readlink -f` for portability — the
# latter two are not guaranteed present (notably stock BSD `readlink`).
_physical_path() {
	local dir="$1"
	(cd "$dir" 2>/dev/null && pwd -P) || printf '%s' "$dir"
}

# _resolve_git_common_dir_abs <dir> — echo the ABSOLUTE, symlink-resolved path
# of <dir>'s `git rev-parse --git-common-dir`, or nothing (exit 1) if <dir> is
# not inside a git repository. `--git-common-dir` is returned relative to
# <dir> for the main worktree (e.g. ".git") but absolute for a linked
# worktree, so the relative case is joined back onto <dir> before
# normalizing — comparing the raw strings would falsely read every
# main-checkout invocation as disagreeing with itself.
_resolve_git_common_dir_abs() {
	local dir="$1"
	local gcd
	gcd=$(git -C "$dir" rev-parse --git-common-dir 2>/dev/null) || return 1
	case "$gcd" in
		/*) _physical_path "$gcd" ;;
		*) _physical_path "${dir}/${gcd}" ;;
	esac
}

# _confirmed_different_repo <dir-a> <dir-b> — 0 (true) ONLY when BOTH sides
# resolve to a git repository and their common dirs are confirmed to differ.
# If either side fails to resolve at all (not a git repo, missing, unset),
# there is no affirmative EVIDENCE of disagreement, so this returns false
# (not confirmed different) — rule 4's fail-open default for an unresolvable
# CLAUDE_PROJECT_DIR. A refusal must be backed by two real, differing
# git-common-dirs, never by a bare string mismatch.
_confirmed_different_repo() {
	local a b
	a=$(_resolve_git_common_dir_abs "$1") || return 1
	b=$(_resolve_git_common_dir_abs "$2") || return 1
	[ -n "$a" ] && [ -n "$b" ] && [ "$a" != "$b" ]
}

# resolve_cli_project_dir — echo the resolved project dir on stdout and
# return 0, OR print a "REFUSING" error to stderr and return 1 with nothing
# on stdout. Callers MUST check the exit status:
#   PROJECT_DIR=$(resolve_cli_project_dir) || exit 1
resolve_cli_project_dir() {
	local cwd_toplevel="" cwd_toplevel_norm=""
	cwd_toplevel=$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)
	[ -n "$cwd_toplevel" ] && cwd_toplevel_norm=$(_physical_path "$cwd_toplevel")

	# Rule 2: SILK_PROJECT_DIR is an explicit override — always wins. Every
	# comparison below is against the symlink-resolved forms (see
	# _physical_path) so a path that is merely spelled differently — e.g.
	# `/tmp/x` vs macOS's real `/private/tmp/x` — never reads as a
	# disagreement; only the ORIGINAL SILK_PROJECT_DIR value is ever echoed
	# or shown to the caller.
	if [ -n "${SILK_PROJECT_DIR:-}" ]; then
		if [ -n "$cwd_toplevel_norm" ] && [ "$(_physical_path "$SILK_PROJECT_DIR")" != "$cwd_toplevel_norm" ]; then
			echo "NOTICE: SILK_PROJECT_DIR (${SILK_PROJECT_DIR}) overrides the resolved cwd toplevel (${cwd_toplevel})." >&2
		fi
		printf '%s' "$SILK_PROJECT_DIR"
		return 0
	fi

	# Rule 1/3/4: cwd resolved to a real git repo.
	if [ -n "$cwd_toplevel" ]; then
		if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ "$(_physical_path "$CLAUDE_PROJECT_DIR")" != "$cwd_toplevel_norm" ] &&
			_confirmed_different_repo "$cwd_toplevel" "$CLAUDE_PROJECT_DIR"; then
			echo "ERROR: refusing to guess the target repository — cwd resolves to '${cwd_toplevel}' but CLAUDE_PROJECT_DIR names a different repository, '${CLAUDE_PROJECT_DIR}'. cd to the repo you mean to operate on, or set SILK_PROJECT_DIR explicitly to override." >&2
			return 1
		fi
		# Rule 3 (same repo, different worktree) or an unresolvable
		# CLAUDE_PROJECT_DIR both fall through here silently — cwd wins.
		printf '%s' "$cwd_toplevel"
		return 0
	fi

	# Rule 5: cwd is not inside a git repo at all — env-var fallback.
	if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
		printf '%s' "$CLAUDE_PROJECT_DIR"
		return 0
	fi

	printf '%s' "$PWD"
	return 0
}

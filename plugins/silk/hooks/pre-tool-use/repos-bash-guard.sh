#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (matcher: Bash) -- deny shell commands that visibly write
# into "${PROJECT_DIR}/.repos/**" (vendored, read-only reference source).
# ".repos/config.json" is host-repo content and stays hand-editable.
#
# This is EARLY-WARNING UX, not the security boundary. The vendored trees
# are OS-permission read-only (ReposLockdown, applied by the repos_manage
# sync/add/pin tooling) -- that permissions layer is the actual backstop, and it
# holds even for the misses documented below. This script only pattern-
# matches $COMMAND and deliberately does NOT attempt full shell parsing --
# accepted, documented misses (the permissions boundary covers all three):
#   - a `cd .repos/x` in an EARLIER Bash call, then a later bare relative
#     write whose own COMMAND string never mentions ".repos"
#   - command substitution / variable indirection building the target path
#     at runtime ($(echo .repos)/x, TARGET=".repos/x"; ...; > "$TARGET")
#   - a script (shell/Python/Node/...) invoked by path that writes into
#     .repos/** internally, without the literal path ever appearing in
#     $COMMAND
#
# SCAN derivation (every leg below, including the early-out, matches
# against SCAN -- never the raw $COMMAND):
#   1. Heredoc-body exclusion: an awk pass deletes every heredoc body --
#      from a line containing `<<`/`<<-` plus an optionally quoted
#      delimiter word, through the line that equals the delimiter -- so
#      prose inside a heredoc payload (`cat >> notes.md <<'EOF' ... rm -rf
#      .repos/x ... EOF`) can't trip the guard (#411). Before intro-matching,
#      each line has its `<<<` here-string operators masked (length-
#      preserving) so the intro regex can't mistake the trailing `<<` of a
#      `<<<` for a heredoc intro and swallow the rest of the command as a
#      never-closing "heredoc body" (#436).
#   2. Whitespace-quoted-payload exclusion: a best-effort sed pass then
#      drops double- and single-quoted segments that contain whitespace --
#      prose like `--body "run rm -rf .repos/x to reproduce"` (#423, #357)
#      -- while leaving whitespace-free quoted paths like ".repos/effect"
#      intact, so a quoted vendored path still trips the guard.
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

# --- SCAN derivation -------------------------------------------------------
# Every leg below (including the early-out) matches against SCAN, never the
# raw $COMMAND -- see the header comment for the two passes.
#
# Pass 1 (heredoc-body exclusion): a small state-machine awk program. Once a
# line matches the heredoc-intro regex (`<<`/`<<-`, optional whitespace, an
# optionally single/double-quoted delimiter word), every subsequent line is
# dropped until (and including) the line that equals the delimiter -- tabs
# stripped first for the `<<-` form. `\047` is the octal escape for `'`,
# used instead of a literal quote char so this stays a single bash single-
# quoted string with no shell-quoting gymnastics. Multiple heredocs in one
# command are each tracked independently as the state machine re-arms after
# each close.
SCAN=$(printf '%s' "$COMMAND" | awk '
	BEGIN { in_heredoc = 0 }
	{
		line = $0
		if (in_heredoc) {
			cmp = line
			if (strip_tabs) sub(/^\t+/, "", cmp)
			if (cmp == delim) { in_heredoc = 0 }
			next
		}
		# Mask here-string operators ("<<<") before intro-matching so the
		# heredoc detector cannot mistake the trailing "<<" of a "<<<" for a
		# heredoc intro (#436) -- a length-preserving 3-char swap, so it only
		# affects this match, never the printed line.
		scanline = line
		gsub(/<<</, "@@@", scanline)
		if (match(scanline, /<<-?[ \t]*[\047\"]?[A-Za-z_][A-Za-z0-9_]*[\047\"]?/)) {
			frag = substr(scanline, RSTART, RLENGTH)
			strip_tabs = (frag ~ /^<<-/)
			word = frag
			sub(/^<<-?[ \t]*/, "", word)
			sub(/^[\047\"]/, "", word)
			sub(/[\047\"]$/, "", word)
			delim = word
			in_heredoc = 1
		}
		print line
	}
')

# Pass 2 (whitespace-quoted-payload exclusion): best-effort sed, run after
# heredoc stripping. Drops any double- or single-quoted segment that
# contains at least one whitespace character -- prose like
# `--body "run rm -rf .repos/x to reproduce"` -- while leaving a
# whitespace-free quoted segment like ".repos/effect" untouched, so a
# quoted vendored path still reaches the matchers below. $sq holds a literal
# single quote so the sed script can stay double-quoted (a bash single-
# quoted string can't itself contain an unescaped `'`).
sq="'"
SCAN=$(printf '%s' "$SCAN" | sed -E "s/\"[^\"]*[[:space:]][^\"]*\"//g; s/${sq}[^${sq}]*[[:space:]][^${sq}]*${sq}//g")

# Cheap early-out (mirrors biome-prefer-mcp.sh's *biome* substring guard):
# every branch below only fires when ".repos" appears literally in SCAN.
[[ "$SCAN" != *.repos* ]] && exit 0

# Token exemption-peeling (a directly-glued redirect operator, dd's "of=",
# one pair of surrounding quotes, then an exact ".repos/config.json"
# compare). Shared by every leg below (git leg's manifest-staging
# allowance, non-git leg's per-shape target analysis) -- defined here, ahead
# of first use, rather than duplicated per leg.
_repos_exempt() {
	local target="$1"
	while [[ "$target" == ">"* ]]; do target="${target#>}"; done
	target="${target#of=}"
	target="${target%\"}"; target="${target#\"}"
	target="${target%\'}"; target="${target#\'}"
	[ "$target" = ".repos/config.json" ]
}

# The one sanctioned `git config` WRITE: removing a submodule registration
# from the superproject's local config. Deliberately narrow on three axes, so
# this stays "drop a stale registration" and never widens into "edit config":
#
#   - REMOVAL verbs only (--unset/--unset-all/--remove-section). Creating or
#     altering a registration is still denied; `sync` owns that.
#   - LOCAL config only. An `-f`/`--file` write targets a file -- `.gitmodules`
#     is tracked host content -- which this allowance is not about.
#   - Every `.repos/`-mentioning token must be a `submodule.<name>` KEY, never
#     a path operand. A submodule's config key embeds its own path by
#     construction, which is precisely why the guard's "a token naming the
#     vendored dir is a target under it" model misfires on `git config`.
#
# Returns 0 (allow) / 1 (deny).
_repos_config_deregister_allowed() {
	local clause="$1"
	if [[ "$clause" =~ (^|[[:space:]])(-f|--file)([[:space:]]|=) ]]; then
		return 1
	fi
	if [[ ! "$clause" =~ (^|[[:space:]])(--unset|--unset-all|--remove-section)([[:space:]]|$) ]]; then
		return 1
	fi
	# shellcheck disable=SC2206 # best-effort word split, as everywhere here
	local tokens=($clause) tok
	for tok in "${tokens[@]}"; do
		[[ "$tok" == *.repos/* ]] || continue
		tok="${tok%\"}"; tok="${tok#\"}"
		tok="${tok%\'}"; tok="${tok#\'}"
		[[ "$tok" == submodule.* ]] || return 1
	done
	return 0
}

# Mode-dependent git subcommands: read-or-write depending on their flags or
# their subverb, so the flat read-ops list cannot classify them by name.
# Listing such a subcommand there permits its writes; omitting it denies its
# reads. Both failures were live:
#
#   - `config` was omitted, so every read fell to the catch-all deny. A
#     submodule's config KEY necessarily embeds its own path
#     (`submodule..repos/<name>.url`), which means the guard's "a token
#     naming the vendored dir is a target under it" model misfires here: the
#     token is a key in a flat namespace addressing the PARENT repo's
#     `.git/config`, a file nowhere near the vendored trees. No submodule
#     config key could be read at all.
#   - `submodule` was likewise omitted, so `git submodule status` — the
#     read that diagnoses a nested-submodule divergence — was denied along
#     with `deinit`.
#   - `remote` was LISTED, so `git remote set-url` against a vendored tree
#     passed: a real write, permitted by name.
#
# Returns 0 (read, allow) / 1 (treat as write). Deliberately conservative:
# anything not positively recognized as a read returns 1.
_repos_clause_is_read() {
	local subcommand="$1" clause="$2"
	# shellcheck disable=SC2206 # best-effort word split, as everywhere here
	local tokens=($clause)
	local i seen=0 verb=""
	for i in "${!tokens[@]}"; do
		if [ "$seen" -eq 0 ]; then
			[ "${tokens[$i]}" = "$subcommand" ] && seen=1
			continue
		fi
		# The subverb is the FIRST non-flag token after the subcommand.
		if [ -z "$verb" ] && [[ "${tokens[$i]}" != -* ]]; then
			verb="${tokens[$i]}"
		fi
	done

	case "$subcommand" in
		config)
			# Dropping a stale submodule REGISTRATION is sanctioned, even though
			# it is a write. `ReposDrift` reports an orphaned
			# `submodule.<name>.*` section -- one left behind by a rename or an
			# unvendoring -- and names `git config --remove-section` as the
			# remedy, but nothing else can perform it: `repos_manage` has no
			# action for it, so denying this leaves a drift the tooling detects
			# and no sanctioned way to clear. The write lands in the
			# superproject's own `.git/config`, never inside `.repos/**`, which
			# is the only thing this guard exists to protect.
			if _repos_config_deregister_allowed "$clause"; then
				return 0
			fi
			# A write flag anywhere disqualifies the clause even if a read flag
			# is also present -- `git config --get x --unset y` must not be
			# cleared by its read half.
			if [[ "$clause" =~ (^|[[:space:]])(--unset|--unset-all|--add|--replace-all|--rename-section|--remove-section|--edit|-e)([[:space:]]|$) ]]; then
				return 1
			fi
			# A read flag is REQUIRED, never merely preferred: the bare
			# `git config <name> <value>` two-positional form is the actual
			# write shape and carries no flag at all, so demanding a read flag
			# is what keeps it denied.
			if [[ "$clause" =~ (^|[[:space:]])(--get|--get-all|--get-regexp|--get-urlmatch|--get-color|--get-colorbool|--list|-l)([[:space:]]|=|$) ]]; then
				return 0
			fi
			return 1
			;;
		submodule)
			case "$verb" in
				status | summary) return 0 ;;
				*) return 1 ;;
			esac
			;;
		remote)
			# Bare `git remote` and `git remote -v` list; `show`/`get-url`
			# read. `add`/`remove`/`rename`/`set-url`/`set-head`/`prune`/
			# `update` all write, and fall through.
			case "$verb" in
				"" | show | get-url) return 0 ;;
				*) return 1 ;;
			esac
			;;
	esac
	return 1
}

# --- Git leg -------------------------------------------------------------
# Fires for any git invocation that targets .repos/ *within its own clause*
# -- via -C/--git-dir=/--work-tree=, or a bare pathspec argument
# (`git rm --cached .repos/x`, `git mv .repos/x .repos/y`). "Own clause"
# means: no ;/&/| between the "git" word and the ".repos/" mention, so a
# trailing chained command (`git status && rm -rf .repos/x`) does NOT
# engage this leg on the strength of the earlier, unrelated git call --
# that rm still reaches the non-git leg below. A command that merely
# mentions .repos in a LATER, unrelated clause than "git" falls through to
# the non-git leg the same way. Once this leg fires it owns the decision
# for the whole command (git-subcommand policy, not the generic word
# matchers) -- consistent with the pre-existing -C/--git-dir/--work-tree
# behavior this leg already had.
GIT_REPOS_RE='(^|[^[:alnum:]_])git[[:space:]][^;&|]*\.repos/'
if [[ "$SCAN" =~ $GIT_REPOS_RE ]]; then
	# Iterate EVERY clause that itself matches GIT_REPOS_RE, not just the
	# first -- a chained `git -C .repos/x log && git -C .repos/x reset --hard
	# HEAD` used to `break` on the first (read) match and `exit 0` the whole
	# command, never reaching the second clause's write (#436 follow-up).
	# Split SCAN into ;/&/|-delimited clauses (same split shape as the cp/mv
	# leg further down), extract the subcommand from EACH matching clause,
	# and deny on the first one that isn't a read op or a sanctioned
	# exemption -- only once every matching clause has cleared does the
	# whole command pass.
	SUBCOMMAND_RE='git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+|--git-dir=[^[:space:]]+[[:space:]]+|--work-tree=[^[:space:]]+[[:space:]]+)*([a-zA-Z-]+)'
	# Operation-named deny messages (#423-1, #423-2): name what's actually
	# happening instead of the one-size "re-pin via repos_manage" message.
	# unvendoring (rm/submodule deinit) has a sanctioned primitive (#422);
	# renaming (mv, #377) now has one too (repos rename) — both messages
	# point at the real tool rather than asking.
	REMOVE_LIFECYCLE_MSG="unvendoring a vendored repo is a lifecycle operation; use repos_manage (action: remove) or savvy repos remove <name> instead of raw git."
	RENAME_LIFECYCLE_MSG="renaming a vendored repo is a lifecycle operation; use repos_manage (action: rename) or savvy repos rename <old> <new> instead of raw git."
	# Recovering a dirty vendored tree (#293) now has a sanctioned primitive
	# too: a hand-run `git reset --hard`/`git clean` against `.repos/**` is
	# exactly the recovery `restore` performs (a staged/committed
	# gitlink-targeted reset + sparse re-apply), so name that instead of the
	# generic pin message.
	RESTORE_LIFECYCLE_MSG="recovering a dirty vendored repo is a lifecycle operation; use repos_manage (action: restore) or savvy repos restore <name...> instead of raw git."

	GIT_CLAUSES="$(printf '%s' "$SCAN" | sed -E 's/(&&|\|\||[;&|])/\n/g')"
	while IFS= read -r clause; do
		[[ "$clause" =~ $GIT_REPOS_RE ]] || continue

		SUBCOMMAND=""
		if [[ "$clause" =~ $SUBCOMMAND_RE ]]; then
			SUBCOMMAND="${BASH_REMATCH[2]}"
		fi
		if [ -z "$SUBCOMMAND" ]; then
			# Matched "git targets .repos" but couldn't confidently isolate
			# the matching clause or extract a subcommand from it -- fail
			# open rather than deny on ambiguity.
			hook_error "$_HOOK" "git-targets-.repos matched but subcommand extraction failed; skipping: $COMMAND"
			exit 0
		fi
		if grep -Fxq "$SUBCOMMAND" "$READ_OPS_FILE" 2>/dev/null; then
			continue
		fi
		# Read-or-write-by-flag subcommands, which the by-name list above
		# cannot decide (see _repos_clause_is_read). Clause-scoped like every
		# other exemption here: a read in this clause never clears a write in
		# a sibling one.
		if _repos_clause_is_read "$SUBCOMMAND" "$clause"; then
			continue
		fi
		# Sanctioned index primitive for re-pointing a vendored repo's
		# gitlink -- doesn't touch vendored *content*, and is a recovery
		# step the guard should not stand in front of:
		#   - `git rm --cached <path>`: index-only removal of the gitlink,
		#     reads/writes nothing inside the vendored tree. Bare `git rm`
		#     (no --cached) deletes the working-tree entry too and stays
		#     denied below.
		# `git mv` is NOT exempted (#377): on a submodule a bare `git mv`
		# leaves the module's `.gitmodules` section name uncanonicalized and
		# skips the rest of the rename sequence (manifest key, verification)
		# even though git itself now fixes `core.worktree`/`.gitmodules`'
		# `path` field on its own (Task 11's real-git probe pinned that
		# against git 2.54). The rename lifecycle op HAS a sanctioned
		# primitive now (Task 11); `git mv` still falls through to the
		# operation-named deny below, routed to a message naming that
		# primitive instead of the raw command.
		# The exemption tests THIS clause, not the whole command: a
		# `--cached` in a sibling clause must not clear a destructive bare
		# `git rm` in this one (both re-reviewers flagged the $SCAN form).
		if [ "$SUBCOMMAND" = "rm" ] \
			&& [[ "$clause" =~ (^|[[:space:]])--cached([[:space:]]|$) ]]; then
			continue
		fi
		# Manifest staging allowance (#379): `git add`/`git restore` are
		# allowed when EVERY token that mentions ".repos/" peels (via the
		# shared _repos_exempt helper, defined above the git leg and reused
		# by the non-git leg below) to exactly ".repos/config.json". A mixed
		# pathspec (config.json plus a vendored path in the same invocation)
		# still denies -- this only clears the pure "stage the manifest"
		# shape.
		if [ "$SUBCOMMAND" = "add" ] || [ "$SUBCOMMAND" = "restore" ]; then
			# Token scan is clause-scoped for the same reason as the rm
			# exemption above: a vendored path in a SIBLING clause must not
			# deny a pure manifest-staging clause (that sibling is judged on
			# its own iteration).
			# shellcheck disable=SC2206 # best-effort word split is the intent
			GIT_TOKENS=($clause)
			all_manifest=1
			saw_repos_token=0
			for tok in "${GIT_TOKENS[@]}"; do
				[[ "$tok" == *.repos/* ]] || continue
				saw_repos_token=1
				_repos_exempt "$tok" || { all_manifest=0; break; }
			done
			if [ "$saw_repos_token" -eq 1 ] && [ "$all_manifest" -eq 1 ]; then
				continue
			fi
		fi
		case "$SUBCOMMAND" in
			rm)
				emit_deny "$REMOVE_LIFECYCLE_MSG"
				;;
			mv)
				emit_deny "$RENAME_LIFECYCLE_MSG"
				;;
			reset | clean)
				emit_deny "$RESTORE_LIFECYCLE_MSG"
				;;
			submodule)
				if [[ "$SCAN" =~ (^|[[:space:]])deinit([[:space:]]|$) ]]; then
					emit_deny "$REMOVE_LIFECYCLE_MSG"
				else
					emit_deny "git writes inside .repos/** are denied; re-pin via repos_manage (action: pin), sync via savvy repos sync, or edit .repos/config.json for notes."
				fi
				;;
			*)
				emit_deny "git writes inside .repos/** are denied; re-pin via repos_manage (action: pin), sync via savvy repos sync, or edit .repos/config.json for notes."
				;;
		esac
		exit 0
	done <<< "$GIT_CLAUSES"
	# Every clause that targeted .repos/ was a read op or a sanctioned
	# exemption -- this leg owns the decision for the whole command either
	# way, so exit 0 rather than falling through to the non-git leg below.
	exit 0
fi

# --- Non-git leg -----------------------------------------------------------
# Per-shape target analysis, not a single "is this command write-shaped"
# flag: which token has to be a non-exempt ".repos/" path depends on the
# shape, so a command isn't denied just because ".repos/" appears somewhere
# in it. ".repos/config.json" is the one hand-editable exception -- exact
# token match only (see _repos_exempt above the git leg; a previous version
# stripped that substring out of $SCAN wholesale, which wrongly cleared
# adjacent-filename writes like ".repos/config.json.bak").
#
#   - redirect (> / >>): deny only when the redirect TARGET token (glued
#     ">file" or the word after a bare operator) is a non-exempt ".repos/"
#     path -- a ".repos/" mention elsewhere on the line (e.g. the source
#     side of `cat .repos/x > out`) does not deny.
#   - tee: deny only when an argument token AFTER "tee" is a non-exempt
#     ".repos/" path, scoped to tee's OWN "|"-delimited pipeline segment --
#     SCAN is split into segments on "|" and seen_tee re-arms per segment
#     (not the shared TOKENS), so a "tee" glued to a preceding pipe with no
#     space (`echo x|tee .repos/f`) still yields a bare "tee" token instead
#     of staying stuck to the previous word as one glued token (#436), and a
#     LATER pipeline command's own .repos/ read (`tee /tmp/out | cat
#     .repos/effect/README.md`) is never mistaken for a still-open tee
#     operand.
#   - sed with an -i flag, rm, patch, dd of=: these mutate their operands,
#     so any non-exempt ".repos/" token anywhere in the command denies
#     (unchanged strictness from the prior single-flag version). sed -i
#     detection stays widened to "sed appears as a command" AND "an
#     -i-shaped flag (-i, -ni, --in-place, ...) appears anywhere", so a
#     reordered flag (`sed -e 's/a/b/' -i .repos/x`) is still caught.
#     Best-effort: a flag value that merely looks like `-i` inside a quoted
#     script argument can false-positive -- accepted; over-denial only
#     costs a re-pin, and the permissions layer is the actual backstop.
#   - cp / mv: deny only when the destination operand is a non-exempt
#     ".repos/" path -- copying/moving OUT of .repos/ is a read and must
#     pass (#325); copying/moving INTO .repos/ still denies. Destination is
#     normally the FINAL operand (last non-flag token), but `-t <dir>` /
#     `--target-directory[=]<dir>` names the destination explicitly and, when
#     present, wins over the last-non-flag-token fallback -- otherwise
#     `cp -t .repos/dir src.ts` would inspect "src.ts" (the source) instead
#     of ".repos/dir" (the actual destination) (#436).
#
# Token exemption-peeling (a directly-glued redirect operator, dd's "of=",
# one pair of surrounding quotes, then an exact ".repos/config.json"
# compare) is factored into _repos_exempt above (defined ahead of the git
# leg, which needs it too) and used by every shape below. Tokens come from
# word-splitting $SCAN (best-effort, not quote-aware -- consistent with the
# rest of this script).

# shellcheck disable=SC2206 # best-effort word split is the intent
TOKENS=($SCAN)

deny=0

# redirect: examine each token that carries a `>`/`>>` (optionally preceded
# by a fd digit, e.g. "2>"). A glued target ("2>.repos/x") is checked
# directly; a bare operator token ("2>") checks the NEXT token as its
# target.
for i in "${!TOKENS[@]}"; do
	tok="${TOKENS[$i]}"
	[[ "$tok" =~ ^[0-9]*\>{1,2}(.*)$ ]] || continue
	glued="${BASH_REMATCH[1]}"
	if [ -n "$glued" ]; then
		target="$glued"
	else
		next=$((i + 1))
		target="${TOKENS[$next]:-}"
	fi
	[[ "$target" == *.repos/* ]] || continue
	_repos_exempt "$target" || deny=1
done

# tee: any token after a token exactly equal to "tee", scoped to tee's OWN
# pipeline segment. Split SCAN into "|"-delimited segments (a newline per
# "|", so a "tee" glued to a preceding pipe with no space -- "echo x|tee
# .repos/f" -- still lands as a bare leading "tee" token on its own segment
# rather than staying stuck to the previous word as one glued token (#436))
# and re-arm seen_tee per segment. Without the per-segment reset, a LATER
# pipeline command's own .repos/ read gets misread as a still-open tee
# operand -- `tee /tmp/out | cat .repos/effect/README.md` would wrongly
# deny, since the flat scan never noticed the "|" boundary and kept
# seen_tee=1 into cat's segment.
if [[ "$SCAN" =~ (^|[^[:alnum:]_])tee([[:space:]]|$) ]]; then
	TEE_SEGMENTS="$(printf '%s' "$SCAN" | sed -E 's/\|/\n/g')"
	while IFS= read -r seg; do
		[[ "$seg" =~ (^|[^[:alnum:]_])tee([[:space:]]|$) ]] || continue
		seen_tee=0
		# shellcheck disable=SC2206 # best-effort word split is the intent
		TEE_TOKENS=($seg)
		for tok in "${TEE_TOKENS[@]}"; do
			if [ "$seen_tee" -eq 1 ] && [[ "$tok" == *.repos/* ]]; then
				_repos_exempt "$tok" || deny=1
			fi
			[ "$tok" = "tee" ] && seen_tee=1
		done
	done <<< "$TEE_SEGMENTS"
fi

# sed -i / rm / patch / dd of=: any non-exempt ".repos/" token anywhere.
sed_i=0
if [[ "$SCAN" =~ (^|[^[:alnum:]_])sed([[:space:]]|$) ]] \
	&& [[ "$SCAN" =~ (^|[[:space:]])(-[A-Za-z]*i|--in-place)([[:space:]]|$) ]]; then
	sed_i=1
fi
# A sed SCRIPT is not a path, and scanning every token could not tell them
# apart. `sed -i 's|.repos/old|.repos/new|g' <files outside .repos>` mentions
# ".repos/" twice inside the EXPRESSION while writing only to its file
# operands, and was denied on the strength of the expression alone -- the
# rename of this repo's own guard fixtures hit exactly that. Positional
# parsing cannot resolve it either: BSD `sed -i ''` takes a backup-suffix
# argument that GNU `sed -i` does not, so "which operand is the script" is
# genuinely ambiguous across platforms.
#
# Recognize the script by SHAPE instead: an optional address, then an `s`/`y`
# command, then its delimiter (`s|`, `s/`, `s#`, `2,5y,`), or a script carried
# by `-e=`/`--expression=`. A real file operand never looks like that -- a
# path token's first character is `.`, `/`, or a name character followed by
# more name characters, so `src/.repos/x` and `.repos/s.txt` both stay paths.
_SED_SCRIPT_RE='^[0-9,$]*[sy][^[:alnum:]_[:space:]]'
_repos_is_sed_script() {
	local tok="$1"
	tok="${tok%\"}"; tok="${tok#\"}"
	tok="${tok%\'}"; tok="${tok#\'}"
	[[ "$tok" =~ ^--?e(xpression)?= ]] && return 0
	[[ "$tok" =~ $_SED_SCRIPT_RE ]] && return 0
	return 1
}

if [ "$sed_i" -eq 1 ] \
	|| [[ "$SCAN" =~ (^|[^[:alnum:]_])rm([[:space:]]|$) ]] \
	|| [[ "$SCAN" =~ (^|[^[:alnum:]_])patch([[:space:]]|$) ]] \
	|| [[ "$SCAN" =~ dd[[:space:]].*of= ]]; then
	for tok in "${TOKENS[@]}"; do
		[[ "$tok" == *.repos/* ]] || continue
		# Scoped to the sed case: only a sed invocation has a non-path operand
		# to skip, so rm/patch/dd keep the unchanged any-token strictness.
		if [ "$sed_i" -eq 1 ] && _repos_is_sed_script "$tok"; then
			continue
		fi
		_repos_exempt "$tok" || deny=1
	done
fi

# cp / mv: only the final non-flag token (the destination operand) --
# clause-scoped, same "don't cross a clause boundary" principle as the git
# leg's [^;&|]* match a few dozen lines up. Without this, the whole-command
# last token of a chained command (`cp a.ts .repos/x && echo done`) would be
# "done", silently masking an in-clause deny -- a common agent-bash shape.
# Split SCAN into clauses on ; & | && || (sed, best-effort, not quote-aware
# like the rest of this script), then apply the last-non-flag-token rule
# independently to every clause that itself mentions cp/mv as a word.
if [[ "$SCAN" =~ (^|[^[:alnum:]_])cp([[:space:]]|$) ]] \
	|| [[ "$SCAN" =~ (^|[^[:alnum:]_])mv([[:space:]]|$) ]]; then
	# A here-string (<<<), not < <(process substitution): the latter loses a
	# final clause with no trailing newline (an unterminated last line) in
	# this environment -- <<< always appends one, so the clause split
	# survives even when $SCAN itself has no trailing newline.
	CLAUSES="$(printf '%s' "$SCAN" | sed -E 's/(&&|\|\||[;&|])/\n/g')"
	while IFS= read -r clause; do
		[[ "$clause" =~ (^|[^[:alnum:]_])(cp|mv)([[:space:]]|$) ]] || continue
		# shellcheck disable=SC2206
		CLAUSE_TOKENS=($clause)
		# cp -t <dir> / --target-directory=<dir> / --target-directory <dir>
		# names the destination explicitly -- the last-non-flag-token rule
		# below would otherwise land on the LAST source operand instead
		# (`cp -t .repos/dir src.ts`: last non-flag token is "src.ts", the
		# source, while ".repos/dir" -- the actual destination -- sits right
		# after the -t flag) (#436). When present, this wins over the
		# last-non-flag-token fallback.
		dest=""
		for idx in "${!CLAUSE_TOKENS[@]}"; do
			tok="${CLAUSE_TOKENS[$idx]}"
			case "$tok" in
				-t)
					nxt=$((idx + 1))
					dest="${CLAUSE_TOKENS[$nxt]:-}"
					;;
				-t?*)
					dest="${tok#-t}"
					;;
				--target-directory=*)
					dest="${tok#--target-directory=}"
					;;
				--target-directory)
					nxt=$((idx + 1))
					dest="${CLAUSE_TOKENS[$nxt]:-}"
					;;
			esac
		done
		if [ -n "$dest" ]; then
			last="$dest"
		else
			last=""
			for tok in "${CLAUSE_TOKENS[@]}"; do
				[[ "$tok" == -* ]] && continue
				last="$tok"
			done
		fi
		if [[ "$last" == *.repos/* ]]; then
			_repos_exempt "$last" || deny=1
		fi
	done <<< "$CLAUSES"
fi

if [ "$deny" -eq 1 ]; then
	emit_deny "writes inside .repos/** are denied; use repos_manage (or savvy repos) to mutate vendored repos, or edit .repos/config.json directly for notes and orientation."
	exit 0
fi

exit 0

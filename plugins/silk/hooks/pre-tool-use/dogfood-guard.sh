#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (matchers: Bash "git push" / "gh pr create" / "gh pr edit";
# the GitKraken MCP equivalents git_push / pull_request_create; the GitHub
# MCP server's create_pull_request / update_pull_request / push_files) --
# deny pushing or opening a PR while THIS repo's tree carries a machine-local
# dogfood link. See skills/dogfood/SKILL.md for the full protocol; this is
# the enforced half of its "no push / no PR while linked" discipline
# (docs/superpowers/specs/2026-07-16-dogfood-mailbox-skill-design.md).
#
# The hazard is NOT publishing: pnpm-workspace.yaml is never published, and a
# published manifest carries registry ranges, with workspace:* transformed to
# exact versions by the bundler. The real hazard is that a `file:../../`
# override in pnpm-workspace.yaml's overrides block resolves only on THIS
# machine -- every other clone, and any CI job that installs, fails to
# resolve the dependency and breaks.
#
# The decision is keyed on TREE STATE, not journal bookkeeping alone
# (savvy-web/systems#387 fixed a false-deny where journal role/phase denied a
# push on a tree with no override at all; savvy-web/systems#332 is the
# opposite failure this guard must not reopen -- a real override with no
# journal yet):
#   - `dev` branch: exempt unconditionally. It is a long-lived integration
#     branch, force-reset from main after every release, never merged INTO
#     anything; actions consumed from @dev are consumed as compiled bundles,
#     so nothing downstream installs and a file: override there is inert.
#   - a `file:`/`link:` override escaping the repo, found in
#     pnpm-workspace.yaml's `overrides:` block, on any other branch: DENY.
#     Only that block is scanned -- not pnpm-lock.yaml, whose link: paths are
#     importer-relative and include the repo's own healthy internal linking
#     strategy (root CLAUDE.md's dist/dev/pkg symlinks), which a naive scan
#     over the lockfile would false-positive on for every clean checkout.
#   - no override, and a downstream journal's last valid line is in a
#     non-"unlinked" phase: allow, with a warning via additionalContext.
#   - no override, no journal (or nothing downstream/active): allow, silent.
#   - a downstream journal whose packagesDerived is explicitly false (closure
#     not yet derived -- unknown, not known-clean) in a non-"unlinked" phase,
#     on any branch but dev: DENY. packagesDerived is a three-state field --
#     absent (upstream journals, and downstream journals written before this
#     field existed) must NOT be treated as false.
#
# For `git push` (Bash) specifically, the tree scanned is the PUSHED REF's
# committed content, not always PROJECT_DIR's working tree (savvy-web/systems
# #603 follow-up 2): the working tree is wrong for both a `git push origin
# some-clean-branch` cut from a linked checkout (tsdoctor#213 -- falsely
# denies content that carries no override) and a linked branch pushed by name
# from an otherwise-clean checkout (falsely allows). Every parsed refspec's
# source is resolved (`git rev-parse --verify --quiet <src>^{commit}`) and
# compared against current HEAD; a source that resolves to something else is
# scanned via `git show <src>:pnpm-workspace.yaml` instead of the working
# tree, and the `dev` exemption applies to that refspec's PUSHED DESTINATION
# branch too, not only the currently checked-out branch. Multiple refspecs
# deny if ANY carries a local override. `HEAD`, no refspec at all, an
# unresolvable source, `--all`/`--mirror`/`--tags`, and a source matching
# current HEAD all fall back to the working-tree behavior above -- the safe
# direction whenever the parse is uncertain. `--delete`/`-d` pushes no
# content, so it allows outright. `gh pr create`/`gh pr edit` and the
# GitKraken/GitHub MCP equivalents are NOT ref-parsed -- PR creation targets
# a branch already on the remote, so there is no local refspec to resolve.
# When every refspec resolved to committed (non-working-tree) content that
# scanned clean, the packagesDerived:false deny above does not apply either
# -- that deny is about THIS TREE's unknown link state, and a ref already
# proven clean by content isn't that. The advisory context is kept either way.
#
# This is a TRIPWIRE, not a security boundary -- same posture as
# repos-bash-guard.sh/repos-mcp-guard.sh: best-effort command-string matching,
# not full shell parsing. Fails open, per the spec's explicit posture:
#   - no jq / malformed envelope / non-matching tool -> silent exit 0
#   - ".claude/dogfood/" missing, or no *.jsonl files inside it -> silent exit 0
#   - an unparseable tail line -> walk back to the previous line
#   - a journal with NO valid line at all -> skip that journal (logged via
#     hook_error) -- a corrupt journal must never brick every push in the repo
#
# The upstream role is NOT guarded here -- its branch is expected to go to PR
# mid-loop (the upstream-pr phase); see the skill's discipline section.
#
# No bypass flag. A genuinely wrong deny is corrected by appending a
# `correction` snapshot to the journal (the audit trail), not by routing
# around this hook.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/dogfood-guard"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"

TOOL=$(jq -r '.tool_name // empty' <<< "$HOOK_ENVELOPE")
[ -z "$TOOL" ] && exit 0

# git push, in any of its common shapes: plain, with global flags before the
# subcommand (-C dir, --no-pager, ...), with a value-bearing flag, or with
# remote/branch/--force-style arguments after it. Best-effort, not a full
# shell parse (documented miss, same posture as repos-bash-guard.sh).
GIT_PUSH_RE='(^|[^[:alnum:]_])git[[:space:]]+(-[A-Za-z-]+([[:space:]]+[^[:space:]]+)?[[:space:]]+)*push([[:space:]]|$)'
GH_PR_RE='(^|[^[:alnum:]_])gh[[:space:]]+pr[[:space:]]+(create|edit)([[:space:]]|$)'

applicable=0
IS_GIT_PUSH_BASH=0
case "$TOOL" in
	Bash)
		COMMAND=$(jq -r '.tool_input.command // empty' <<< "$HOOK_ENVELOPE")
		[ -z "$COMMAND" ] && exit 0
		if [[ "$COMMAND" =~ $GIT_PUSH_RE ]]; then
			applicable=1
			IS_GIT_PUSH_BASH=1
		fi
		if [[ "$COMMAND" =~ $GH_PR_RE ]]; then
			applicable=1
		fi
		;;
	mcp__gk__*|mcp__gitkraken__*|mcp__GitKraken__*|mcp__github__*|mcp__github-*__*)
		case "$TOOL" in
			mcp__gk__*) OP="${TOOL#mcp__gk__}" ;;
			mcp__gitkraken__*) OP="${TOOL#mcp__gitkraken__}" ;;
			mcp__GitKraken__*) OP="${TOOL#mcp__GitKraken__}" ;;
			mcp__github__*) OP="${TOOL#mcp__github__}" ;;
			mcp__github-*__*)
				REST="${TOOL#mcp__github-}"
				OP="${REST#*__}"
				;;
			*) OP="" ;;
		esac
		case "$OP" in
			git_push|pull_request_create|create_pull_request|update_pull_request|push_files) applicable=1 ;;
		esac
		;;
	*)
		exit 0
		;;
esac

[ "$applicable" -eq 1 ] || exit 0

PROJECT_DIR=$(resolve_project_dir "$HOOK_ENVELOPE")
[ -z "$PROJECT_DIR" ] && exit 0

# `dev` is exempt unconditionally -- see the header comment. Detached HEAD:
# `git rev-parse --abbrev-ref HEAD` returns the literal string "HEAD" there,
# not a branch name. We deliberately let that fall through to "not dev" (the
# safe direction) rather than special-casing it -- detached HEAD is never the
# long-lived dev branch this exemption exists for, and a non-repo
# PROJECT_DIR (rev-parse failing entirely) resolves the same way.
BRANCH=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$BRANCH" = "dev" ] && exit 0

# The hazard is an ARTIFACT fact, not a bookkeeping one: a file:/link: path
# escaping this repo, authored in pnpm-workspace.yaml's `overrides:` block,
# resolves only on this machine. Scan ONLY that block -- not pnpm-lock.yaml.
# The lockfile's link: paths are importer-relative (a link:../../packages/...
# entry resolves inside the repo from its importer but would look like an
# escape if naively joined to the repo root) and include this repo's own
# healthy dist/dev/pkg linking strategy, which false-positives on every
# clean checkout (confirmed: 21 such lines in this repo's own lockfile).
# The overrides block is where the dogfood protocol authors its links
# (SKILL.md --init step 3), it is small, and its paths are root-relative.
#
# Each extracted line has a YAML comment stripped before matching, so
# commenting out a finished loop's override -- the obvious, more
# careful-looking alternative to SKILL.md --exit's "remove the entry" -- does
# not trip a permanent false deny. The strip is QUOTE-AWARE, not a bare
# `#`-to-end-of-line cut: a `#` only starts a comment when it is outside any
# '...'/"..." span AND is at line-start or preceded by whitespace, matching
# real YAML's rule. Quote-blindness would be the wrong direction to get
# wrong -- a naive whitespace-gated strip (no quote tracking) still truncates
# a legitimate quoted value like "weird #value file:../../x", deleting the
# override it was supposed to detect and turning a real link into a MISSED
# deny, which is worse than the false deny this fix exists to close. A
# backslash unconditionally consumes the next character without letting it
# flip quote state, so a value like "esc \" #v file:../../x" does not have
# its embedded `\"` mistaken for the closing quote (which would flip
# in-quote state early and expose the `#` as a comment start, stripping the
# override away).
#
# Known limitation, not worth handling: a flow-style single-line block
# (`overrides: {"@e/g": "file:../../x"}`) is invisible to this scan, since
# the `next` on the `overrides:` match line itself skips anything written on
# that same line. Not reachable through the documented protocol -- SKILL.md
# --init always writes block style -- so left undetected rather than
# complicating the parser for a shape nothing produces.
LOCAL_OVERRIDE_RE='(file|link):(\.\./|/)'

# Extracted into a function (savvy-web/systems#603 follow-up 2) so the same
# quote-aware, comment-stripping overrides-block scan runs over EITHER the
# working tree's pnpm-workspace.yaml or a `git show <ref>:pnpm-workspace.yaml`
# snapshot of a pushed ref's committed content -- see the refspec-resolution
# block below for which one applies.
_overrides_block_has_local_link() {
	local content="$1" block
	block=$(awk '/^overrides:/{f=1;next} f && /^[a-zA-Z]/{f=0} f' <<< "$content" 2>/dev/null \
		| awk '
			{
				line = $0
				n = length(line)
				in_s = 0; in_d = 0
				out = ""
				for (i = 1; i <= n; i++) {
					c = substr(line, i, 1)
					if (c == "\\" && i < n) {
						out = out c substr(line, i + 1, 1)
						i++
						continue
					}
					if (c == "\047" && !in_d) { in_s = !in_s; out = out c; continue }
					if (c == "\"" && !in_s) { in_d = !in_d; out = out c; continue }
					if (c == "#" && !in_s && !in_d) {
						prev = (i == 1) ? "" : substr(line, i - 1, 1)
						if (i == 1 || prev ~ /[ \t]/) break
					}
					out = out c
				}
				print out
			}
		' 2>/dev/null || true)
	[ -n "$block" ] && grep -Eq "$LOCAL_OVERRIDE_RE" <<< "$block" 2>/dev/null
}

# Best-effort refspec resolution, `git push` (Bash) only -- gh pr create/edit
# and the GitKraken/GitHub MCP equivalents keep the working-tree-only
# behavior below unchanged: PR creation targets whatever branch is ALREADY on
# the remote, so there is no local refspec to parse, and the whole question
# this block exists to answer (which committed content is about to move) does
# not arise for them.
#
# The guard previously scanned only PROJECT_DIR's working tree, which is
# wrong in both directions (tsdoctor#213 and its mirror): `git push origin
# some-clean-branch` from a tree that currently carries a LOCAL override
# falsely denies a push of content that never carries it, and pushing a
# LINKED branch by name from an otherwise-clean checkout falsely allows.
#
# TARGETS_WORKTREE=1 (the default) means "reason about PROJECT_DIR's working
# tree", preserving every pre-existing code path (including uncommitted
# overrides denying, and the packagesDerived:false tree-state deny below).
# It flips to 0 only when EVERY refspec resolved to committed content other
# than the current HEAD branch -- at that point the working tree is simply
# not what is being pushed, and TARGETS_REF carries the resolved sources to
# scan instead (via `git show <src>:pnpm-workspace.yaml`).
TARGETS_WORKTREE=1
TARGETS_REF=()
if [ "$IS_GIT_PUSH_BASH" -eq 1 ]; then
	# ONE decision covers the whole command string, so every guarded action in
	# it has to be accounted for -- not just the first `git push`. Split on
	# shell control operators and newlines and let each segment contribute:
	# a `gh pr create|edit` segment needs the working tree; a `git push`
	# segment contributes its resolved pushed refs, or the working tree when
	# its target is uncertain. The union is scanned below. (Scoping the parse
	# to the first push alone let a clean first push -- or a dev/delete
	# exemption -- wave through a chained PR or a chained push of a linked
	# ref.) Best-effort, not a full shell parse: a quoted separator splits a
	# segment early, which at worst makes a push look unresolvable and falls
	# back to the working-tree scan -- more scanning, never less.
	TARGETS_WORKTREE=0
	SAW_PUSH=0
	CURRENT_SHA=$(git -C "$PROJECT_DIR" rev-parse --verify --quiet "HEAD^{commit}" 2>/dev/null || echo "")
	SEGMENTS=$(tr ';&|' '\n' <<< "$COMMAND")
	while IFS= read -r seg; do
		[[ "$seg" =~ $GH_PR_RE ]] && TARGETS_WORKTREE=1
		[[ "$seg" =~ $GIT_PUSH_RE ]] || continue
		SAW_PUSH=1
		# Anchor on the GIT_PUSH_RE match itself, not the first "push"
		# substring (which can sit inside an earlier commit message).
		REST="${seg#*"${BASH_REMATCH[0]}"}"
		MODE_FLAG=""
		REMOTE_SEEN=0
		REFSPECS=()
		# No pathname expansion during the word split: a refspec like
		# `feat/*` must stay a literal token, not expand against the cwd.
		set -f
		# shellcheck disable=SC2086
		set -- $REST
		set +f
		for tok in "$@"; do
			case "$tok" in
				--delete|-d) MODE_FLAG="delete" ;;
				--all|--mirror|--tags) MODE_FLAG="bulk" ;;
				-*) : ;;
				*)
					if [ "$REMOTE_SEEN" -eq 0 ]; then
						REMOTE_SEEN=1
					else
						REFSPECS+=("$tok")
					fi
					;;
			esac
		done

		if [ "$MODE_FLAG" = "delete" ]; then
			continue # a delete pushes no content
		elif [ "$MODE_FLAG" = "bulk" ] || [ "${#REFSPECS[@]}" -eq 0 ]; then
			# --all/--mirror/--tags, or no refspec (pushes the current
			# branch): reason about the working tree.
			TARGETS_WORKTREE=1
			continue
		fi
		for spec in "${REFSPECS[@]}"; do
			spec="${spec#+}" # strip a leading force prefix
			src="${spec%%:*}"
			if [[ "$spec" == *:* ]]; then dst="${spec#*:}"; else dst="$src"; fi
			[ -z "$src" ] && continue # ":branch" delete form -- no content pushed
			dst_name="${dst#refs/heads/}"
			# The `dev` exemption applies to the PUSHED destination too, not
			# only the current checkout (see header comment): a push whose
			# destination is dev carries no hazard regardless of source.
			[ "$dst_name" = "dev" ] && continue
			if [ "$src" = "HEAD" ]; then
				TARGETS_WORKTREE=1
				continue
			fi
			resolved_sha=$(git -C "$PROJECT_DIR" rev-parse --verify --quiet "${src}^{commit}" 2>/dev/null || echo "")
			if [ -z "$resolved_sha" ]; then
				# Unresolvable -- the safe direction is the existing
				# working-tree behavior, not silently skipping the scan.
				TARGETS_WORKTREE=1
			elif [ -n "$CURRENT_SHA" ] && [ "$resolved_sha" = "$CURRENT_SHA" ]; then
				# Same commit as the current HEAD branch -- reason about the
				# working tree, which also catches an uncommitted override
				# the pushed commit itself doesn't yet carry.
				TARGETS_WORKTREE=1
			else
				TARGETS_REF+=("$src")
			fi
		done
	done <<< "$SEGMENTS"

	# GIT_PUSH_RE matched the whole command but no single segment -- the
	# split lost it; fall back rather than guess.
	[ "$SAW_PUSH" -eq 0 ] && TARGETS_WORKTREE=1
	if [ "$TARGETS_WORKTREE" -eq 0 ] && [ "${#TARGETS_REF[@]}" -eq 0 ]; then
		# Every guarded action was a delete or a dev-destination push -- no
		# non-exempt content is being pushed and no PR is being opened.
		exit 0
	fi
fi

has_local_override=0
override_found_in=""

if [ "$TARGETS_WORKTREE" -eq 1 ]; then
	WS_FILE="${PROJECT_DIR}/pnpm-workspace.yaml"
	if [ -f "$WS_FILE" ] && _overrides_block_has_local_link "$(cat "$WS_FILE")"; then
		has_local_override=1
		override_found_in="worktree"
	fi
fi

if [ "$has_local_override" -eq 0 ] && [ "${#TARGETS_REF[@]}" -gt 0 ]; then
	for ref in "${TARGETS_REF[@]}"; do
		ref_content=$(git -C "$PROJECT_DIR" show "${ref}:pnpm-workspace.yaml" 2>/dev/null || echo "")
		if [ -n "$ref_content" ] && _overrides_block_has_local_link "$ref_content"; then
			has_local_override=1
			override_found_in="$ref"
			break
		fi
	done
fi

if [ "$has_local_override" -eq 1 ]; then
	if [ "$override_found_in" = "worktree" ]; then
		emit_deny "this tree carries a file:/link: dependency override pointing outside the repo, in pnpm-workspace.yaml's overrides block -- it resolves only on this machine, so pushing it breaks the install for every other clone and any CI job that installs. Run /silk:dogfood --exit to unlink first, or push to dev, which is exempt."
	else
		emit_deny "the ref being pushed (${override_found_in}) carries a committed file:/link: dependency override pointing outside the repo, in pnpm-workspace.yaml's overrides block -- it resolves only on this machine, so pushing it breaks the install for every other clone and any CI job that installs. Fix the override on that ref before pushing it, or push to dev, which is exempt."
	fi
	exit 0
fi

DOGFOOD_DIR="${PROJECT_DIR}/.claude/dogfood"
[ -d "$DOGFOOD_DIR" ] || exit 0

shopt -s nullglob
journals=("${DOGFOOD_DIR}"/*.jsonl)
shopt -u nullglob
[ "${#journals[@]}" -eq 0 ] && exit 0

# Tree is clean of overrides. The journal is now ADVISORY -- except for a
# downstream loop whose linked-package closure has not been derived yet,
# which is unknown rather than known-clean (savvy-web/systems#331).
advisory=""
for journal in "${journals[@]}"; do
	loop_id="$(basename "$journal" .jsonl)"

	# Walk the file bottom-up (awk reverses it -- portable across the
	# GNU/BSD `tac`-vs-`tail -r` split, and avoids bash4-only mapfile). The
	# first line that survives `jq -e` as a JSON object is the tail's last
	# VALID snapshot, per the journal's corrupt-tail-self-heals contract; an
	# unparseable line is skipped in favor of the one before it.
	last_valid=""
	while IFS= read -r line; do
		[ -z "$line" ] && continue
		if jq -e 'type == "object"' >/dev/null 2>&1 <<< "$line"; then
			last_valid="$line"
			break
		fi
	done < <(awk '{ lines[NR] = $0 } END { for (i = NR; i >= 1; i--) print lines[i] }' "$journal" 2>/dev/null)

	if [ -z "$last_valid" ]; then
		hook_error "$_HOOK" "journal ${journal} has no valid JSONL line; skipping (fail-open)"
		continue
	fi

	role=$(jq -r '.role // empty' <<< "$last_valid")
	phase=$(jq -r '.phase // empty' <<< "$last_valid")
	# packagesDerived is a THREE-state field: absent (upstream journals, and
	# downstream journals written before this field existed) must NOT be
	# treated as false. Compare the explicit string form against "false" --
	# `.packagesDerived // false` would collapse absent into false and deny
	# on every pre-existing journal.
	derived=$(jq -r 'if has("packagesDerived") then (.packagesDerived | tostring) else "" end' <<< "$last_valid")

	[ "$role" = "downstream" ] || continue
	if [ -z "$phase" ] || [ "$phase" = "unlinked" ]; then
		continue
	fi

	if [ "$derived" = "false" ]; then
		# The deny is about THIS TREE's unknown link state. When every target
		# resolved to committed content already scanned clean above
		# (TARGETS_WORKTREE=0), that content is known, not unknown -- the
		# tree-state deny doesn't apply to a ref we've already proven clean.
		# Keep the advisory context either way.
		if [ "$TARGETS_WORKTREE" -eq 1 ]; then
			emit_deny "dogfood loop \"${loop_id}\" has not derived its linked-package closure yet (packagesDerived is false), so whether this tree is linked is unknown rather than known-clean. Derive the closure and append a correction snapshot before pushing, or push to dev, which is exempt."
			exit 0
		fi
		advisory="${advisory}${advisory:+, }${loop_id} (${phase}, closure not yet derived in the working tree)"
		continue
	fi

	advisory="${advisory}${advisory:+, }${loop_id} (${phase})"
done

if [ -n "$advisory" ]; then
	emit_context "PreToolUse" "Dogfood loop still open: ${advisory}. The tree carries no file:/link: overrides, so this push is allowed. If the loop is finished, run /silk:dogfood --exit to record the terminal unlinked snapshot."
fi

exit 0

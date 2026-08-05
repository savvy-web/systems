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
case "$TOOL" in
	Bash)
		COMMAND=$(jq -r '.tool_input.command // empty' <<< "$HOOK_ENVELOPE")
		[ -z "$COMMAND" ] && exit 0
		if [[ "$COMMAND" =~ $GIT_PUSH_RE ]] || [[ "$COMMAND" =~ $GH_PR_RE ]]; then
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
WS_FILE="${PROJECT_DIR}/pnpm-workspace.yaml"
has_local_override=0
if [ -f "$WS_FILE" ]; then
	overrides_block=$(awk '/^overrides:/{f=1;next} f && /^[a-zA-Z]/{f=0} f' "$WS_FILE" 2>/dev/null \
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
	if [ -n "$overrides_block" ] && grep -Eq "$LOCAL_OVERRIDE_RE" <<< "$overrides_block" 2>/dev/null; then
		has_local_override=1
	fi
fi

if [ "$has_local_override" -eq 1 ]; then
	emit_deny "this tree carries a file:/link: dependency override pointing outside the repo, in pnpm-workspace.yaml's overrides block -- it resolves only on this machine, so pushing it breaks the install for every other clone and any CI job that installs. Run /silk:dogfood --exit to unlink first, or push to dev, which is exempt."
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
		emit_deny "dogfood loop \"${loop_id}\" has not derived its linked-package closure yet (packagesDerived is false), so whether this tree is linked is unknown rather than known-clean. Derive the closure and append a correction snapshot before pushing, or push to dev, which is exempt."
		exit 0
	fi

	advisory="${advisory}${advisory:+, }${loop_id} (${phase})"
done

if [ -n "$advisory" ]; then
	emit_context "PreToolUse" "Dogfood loop still open: ${advisory}. The tree carries no file:/link: overrides, so this push is allowed. If the loop is finished, run /silk:dogfood --exit to record the terminal unlinked snapshot."
fi

exit 0

#!/usr/bin/env bash
set -euo pipefail

# Appends one snapshot line to a dogfood loop journal
# (.claude/dogfood/<counterpart-id>.jsonl), carrying forward the loop's static
# config and patching only what the caller passes (savvy-web/systems#338).
#
# The journal is append-only and every line is a COMPLETE snapshot -- current
# state is the last valid line, with no fold anywhere. That contract is
# unchanged here; this script only removes the hand-rolled jq object that
# repeating the static fields otherwise required.
#
# Compose, validate, then act: nothing is appended unless the resulting object
# is valid JSON with an allowed event/phase/ball and an unchanged role.

usage() {
	cat >&2 <<-'EOF'
		usage: journal-append.sh <journal> --event <event> [patches...]
		       journal-append.sh <journal> --init --role <role> \
		           --counterpart-id <id> --counterpart-path <path> --link-type <type> \
		           [--note <text>] [--owner <token>]

		patches: --phase --ball --round --mail-in --mail-out --note --pr
		         --packages-derived true|false --owner
		         --package '<name>=<override>' (repeatable, downstream only)
		         --clear-packages (downstream only; sets packages back to [])
		         (only --note and --owner are valid alongside --init; the rest
		         describe a change against a prior line, which --init has none of)
		events:  loop-started mail-sent mail-received phase-change pr-recorded
		         correction unlinked
		phases:  requested implementing handoff adopting findings upstream-pr
		         released unlinked
		balls:   ours theirs
		linkTypes: pnpm-overrides file (bun reserved, not yet implemented)
	EOF
	exit 2
}

command -v jq >/dev/null 2>&1 || { echo "journal-append: jq is required" >&2; exit 1; }

[ "$#" -ge 1 ] || usage
JOURNAL="$1"; shift

EVENT="" PHASE="" BALL="" ROUND="" MAIL_IN="" MAIL_OUT="" NOTE="" PR=""
PACKAGES_DERIVED="" OWNER="" ROLE="" CP_ID="" CP_PATH="" LINK_TYPE="" INIT=0
CLEAR_PACKAGES=0
PACKAGES=()

while [ "$#" -gt 0 ]; do
	case "$1" in
		--init) INIT=1; shift ;;
		--event) EVENT="${2:-}"; shift 2 ;;
		--phase) PHASE="${2:-}"; shift 2 ;;
		--ball) BALL="${2:-}"; shift 2 ;;
		--round) ROUND="${2:-}"; shift 2 ;;
		--mail-in) MAIL_IN="${2:-}"; shift 2 ;;
		--mail-out) MAIL_OUT="${2:-}"; shift 2 ;;
		--note) NOTE="${2:-}"; shift 2 ;;
		--pr) PR="${2:-}"; shift 2 ;;
		--packages-derived) PACKAGES_DERIVED="${2:-}"; shift 2 ;;
		--package) PACKAGES+=("${2:-}"); shift 2 ;;
		--clear-packages) CLEAR_PACKAGES=1; shift ;;
		--owner) OWNER="${2:-}"; shift 2 ;;
		--role) ROLE="${2:-}"; shift 2 ;;
		--counterpart-id) CP_ID="${2:-}"; shift 2 ;;
		--counterpart-path) CP_PATH="${2:-}"; shift 2 ;;
		--link-type) LINK_TYPE="${2:-}"; shift 2 ;;
		*) echo "journal-append: unknown flag $1" >&2; usage ;;
	esac
done

_valid_event() {
	case "$1" in
		loop-started|mail-sent|mail-received|phase-change|pr-recorded|correction|unlinked) return 0 ;;
		*) return 1 ;;
	esac
}

_valid_phase() {
	case "$1" in
		requested|implementing|handoff|adopting|findings|upstream-pr|released|unlinked) return 0 ;;
		*) return 1 ;;
	esac
}

AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ "$INIT" -eq 1 ]; then
	if [ -z "$ROLE" ] || [ -z "$CP_ID" ] || [ -z "$CP_PATH" ] || [ -z "$LINK_TYPE" ]; then
		usage
	fi

	# Flags that only make sense on a later append (they describe a change
	# against a prior line, and --init has no prior line) are REJECTED, not
	# silently dropped. A silently-ignored flag is a worse failure than a
	# rejected one: the caller sees exit 0 and believes the value landed
	# (savvy-web/systems#391 -- --note was accepted and dropped here, and an
	# agent following SKILL.md's instruction to record it had no signal
	# anything had gone wrong).
	for _pair in "EVENT:--event" "PHASE:--phase" "BALL:--ball" "ROUND:--round" \
		"MAIL_IN:--mail-in" "MAIL_OUT:--mail-out" "PR:--pr" "PACKAGES_DERIVED:--packages-derived"; do
		_var="${_pair%%:*}"
		_flag="${_pair##*:}"
		if [ -n "${!_var}" ]; then
			echo "journal-append: $_flag is not valid with --init (it only applies to a later append against an existing line)" >&2
			exit 1
		fi
	done

	# --package/--clear-packages are array/toggle-shaped, so they don't fit the
	# scalar loop above -- rejected on the same grounds (savvy-web/systems#508):
	# an --init line's closure is always [] / packagesDerived:false, and a
	# closure derived at init time is recorded by a follow-up append, not here.
	if [ "${#PACKAGES[@]}" -gt 0 ] || [ "$CLEAR_PACKAGES" -eq 1 ]; then
		echo "journal-append: --package/--clear-packages are not valid with --init (a new loop always opens with packages: [])" >&2
		exit 1
	fi

	# The opening ball is derived from role, not hardcoded to one side's view
	# (savvy-web/systems#338 known-defect 1): SKILL.md's phase table says the
	# `requested` phase's ball belongs to upstream. A repo opening as
	# downstream sees that as "theirs"; a repo opening as upstream sees its
	# own opening move as "ours".
	case "$ROLE" in
		downstream) INIT_BALL="theirs" ;;
		upstream) INIT_BALL="ours" ;;
		*) echo "journal-append: role must be downstream or upstream" >&2; exit 1 ;;
	esac

	# "none" is not a sanctioned value anywhere in the field contract --
	# reference doc: linkType is "pnpm-overrides" today, "file" as of #338,
	# "bun" reserved and not yet implemented. Do not invent other values.
	case "$LINK_TYPE" in pnpm-overrides|file) ;; *) echo "journal-append: unknown or unsupported linkType '$LINK_TYPE' (bun is reserved, not yet implemented)" >&2; exit 1 ;; esac

	if [ "$ROLE" = downstream ]; then
		LINE=$(jq -nc \
			--arg at "$AT" --arg role "$ROLE" --arg id "$CP_ID" --arg path "$CP_PATH" \
			--arg lt "$LINK_TYPE" --arg ball "$INIT_BALL" --arg owner "$OWNER" --arg note "$NOTE" \
			'{at:$at, event:"loop-started", role:$role,
			  counterpart:{id:$id, path:$path},
			  packages:[], packagesDerived:false,
			  linkType:$lt, nativeRebuilds:[],
			  phase:"requested", ball:$ball, round:0}
			 + (if $owner == "" then {} else {owner:$owner} end)
			 + (if $note == "" then {} else {note:$note} end)')
	else
		# Upstream-side snapshot per jsonl-journal.md: no packages /
		# nativeRebuilds / packagesDerived -- the upstream links nothing.
		LINE=$(jq -nc \
			--arg at "$AT" --arg role "$ROLE" --arg id "$CP_ID" --arg path "$CP_PATH" \
			--arg lt "$LINK_TYPE" --arg ball "$INIT_BALL" --arg owner "$OWNER" --arg note "$NOTE" \
			'{at:$at, event:"loop-started", role:$role,
			  counterpart:{id:$id, path:$path},
			  linkType:$lt,
			  phase:"requested", ball:$ball, round:0}
			 + (if $owner == "" then {} else {owner:$owner} end)
			 + (if $note == "" then {} else {note:$note} end)')
	fi
	printf '%s\n' "$LINE" >> "$JOURNAL"
	echo "journal-append: wrote loop-started for $CP_ID (role=$ROLE ball=$INIT_BALL)"
	exit 0
fi

[ -n "$EVENT" ] || usage
_valid_event "$EVENT" || { echo "journal-append: invalid event '$EVENT'" >&2; exit 1; }
[ -n "$PHASE" ] && { _valid_phase "$PHASE" || { echo "journal-append: invalid phase '$PHASE'" >&2; exit 1; }; }
[ -n "$BALL" ] && { case "$BALL" in ours|theirs) ;; *) echo "journal-append: invalid ball '$BALL'" >&2; exit 1 ;; esac; }
[ -n "$PACKAGES_DERIVED" ] && { case "$PACKAGES_DERIVED" in true|false) ;; *) echo "journal-append: --packages-derived must be true or false, got '$PACKAGES_DERIVED'" >&2; exit 1 ;; esac; }
[ -n "$ROLE" ] && { echo "journal-append: role is fixed for a loop; append a correction event instead of changing it" >&2; exit 1; }

# --package / --clear-packages (savvy-web/systems#508). A snapshot is a
# COMPLETE state, so these REPLACE the whole array rather than merging into
# it: --package a --package b means the closure is exactly {a, b}, and
# --clear-packages means it is empty. Both are downstream-only (checked
# against the prior line's role, below, once it has been read) -- an upstream
# journal carries no packages field at all.
if [ "${#PACKAGES[@]}" -gt 0 ] && [ "$CLEAR_PACKAGES" -eq 1 ]; then
	echo "journal-append: --package and --clear-packages are mutually exclusive (a snapshot names one complete closure)" >&2
	exit 1
fi
PACKAGES_JSON=""
if [ "${#PACKAGES[@]}" -gt 0 ]; then
	PACKAGES_JSON="[]"
	for _spec in "${PACKAGES[@]}"; do
		case "$_spec" in
			*=*) ;;
			*) echo "journal-append: --package must be '<name>=<override>', got '$_spec'" >&2; exit 1 ;;
		esac
		_name="${_spec%%=*}"
		_override="${_spec#*=}"
		[ -n "$_name" ] || { echo "journal-append: --package name is empty in '$_spec'" >&2; exit 1; }
		[ -n "$_override" ] || { echo "journal-append: --package override is empty in '$_spec'" >&2; exit 1; }
		PACKAGES_JSON=$(jq -c --arg n "$_name" --arg o "$_override" '. + [{name:$n, override:$o}]' <<< "$PACKAGES_JSON")
	done
elif [ "$CLEAR_PACKAGES" -eq 1 ]; then
	PACKAGES_JSON="[]"
fi
[ -f "$JOURNAL" ] || { echo "journal-append: $JOURNAL not found (use --init for a new loop)" >&2; exit 1; }

# --pr must be repo#number. Validate and split it in bash rather than in the
# jq filter (known-defect 2): `jq ... | tonumber` on a malformed value dies
# with a jq stack trace instead of a readable message.
PR_REPO="" PR_NUM=""
if [ -n "$PR" ]; then
	case "$PR" in
		*#*)
			PR_REPO="${PR%%#*}"
			PR_NUM="${PR##*#}"
			case "$PR_NUM" in
				''|*[!0-9]*) echo "journal-append: --pr number must be numeric, got '$PR'" >&2; exit 1 ;;
			esac
			[ -n "$PR_REPO" ] || { echo "journal-append: --pr must be repo#number, got '$PR'" >&2; exit 1; }
			;;
		*) echo "journal-append: --pr must be repo#number, got '$PR'" >&2; exit 1 ;;
	esac
fi

# --round must be a non-negative integer -- validated here rather than left to
# the jq filter, same reasoning as --pr above (known-defect 2): `| tonumber`
# on a malformed value dies with a raw jq stack trace instead of a readable
# message. The journal is untouched either way (append happens only after
# every flag validates), but a clean error is worth being consistent about.
if [ -n "$ROUND" ]; then
	case "$ROUND" in
		''|*[!0-9]*) echo "journal-append: --round must be a non-negative integer, got '$ROUND'" >&2; exit 1 ;;
	esac
fi

# Last VALID line, walking back past a corrupt tail -- same contract the
# readers (guard, monitor, --status) use.
PREV=""
while IFS= read -r line; do
	[ -z "$line" ] && continue
	if jq -e 'type == "object"' >/dev/null 2>&1 <<< "$line"; then PREV="$line"; break; fi
done < <(awk '{ lines[NR] = $0 } END { for (i = NR; i >= 1; i--) print lines[i] }' "$JOURNAL")

[ -n "$PREV" ] || { echo "journal-append: $JOURNAL has no valid line to inherit from" >&2; exit 1; }

# Owner-token check (#334): exactly one session may hold a role in a loop. A
# mismatch warns rather than rejecting -- a hard lease would lock a
# legitimately-resumed session out of its own loop with nobody awake to arbitrate.
PREV_OWNER=$(jq -r '.owner // empty' <<< "$PREV")
if [ -n "$OWNER" ] && [ -n "$PREV_OWNER" ] && [ "$OWNER" != "$PREV_OWNER" ]; then
	echo "journal-append: WARNING -- last snapshot was written by owner '$PREV_OWNER', this one by '$OWNER'. Two sessions driving one role corrupts the mail chain (savvy-web/systems#334). Confirm the other session has stopped before continuing." >&2
fi

# Downstream-only, same posture as the other downstream-only fields: an
# upstream journal has no packages array, and writing one would misdescribe a
# side that links nothing.
if [ -n "$PACKAGES_JSON" ] && [ "$(jq -r '.role // empty' <<< "$PREV")" != "downstream" ]; then
	echo "journal-append: --package/--clear-packages are downstream-only; this journal's role is '$(jq -r '.role // "unknown"' <<< "$PREV")'" >&2
	exit 1
fi

# A NONEMPTY closure and packagesDerived:false are a contradiction: the array
# names the overrides that are actually live, so writing it IS the derivation.
# A link-lazy loop opens packagesDerived:false and carries that value forward,
# so the contradiction is what you get by DEFAULT when --package is passed
# without --packages-derived true -- the flag has to be refused rather than
# silently accepted, the same reasoning as the --init rejections above
# (savvy-web/systems#391). The state is fail-safe rather than dangerous (the
# push guard denies on packagesDerived:false), but it misdescribes the tree to
# every reader, which is the whole reason #508 wanted the array truthful.
# --clear-packages is deliberately exempt: an EMPTY closure carries no such
# claim, and --exit's terminal snapshot clears without asserting a derivation.
if [ "${#PACKAGES[@]}" -gt 0 ]; then
	EFFECTIVE_DERIVED="$PACKAGES_DERIVED"
	if [ -z "$EFFECTIVE_DERIVED" ]; then
		EFFECTIVE_DERIVED=$(jq -r 'if has("packagesDerived") then (.packagesDerived | tostring) else "" end' <<< "$PREV")
	fi
	if [ "$EFFECTIVE_DERIVED" != "true" ]; then
		echo "journal-append: --package writes a nonempty closure, which requires --packages-derived true (effective value here is '${EFFECTIVE_DERIVED:-unset}'). A nonempty packages array with packagesDerived false claims the closure is both known and underived." >&2
		exit 1
	fi
fi

NEXT=$(jq -c \
	--arg at "$AT" --arg event "$EVENT" --arg phase "$PHASE" --arg ball "$BALL" \
	--arg round "$ROUND" --arg mailIn "$MAIL_IN" --arg mailOut "$MAIL_OUT" \
	--arg note "$NOTE" --arg prRepo "$PR_REPO" --arg prNum "$PR_NUM" \
	--arg pd "$PACKAGES_DERIVED" --arg owner "$OWNER" \
	--argjson pkgs "${PACKAGES_JSON:-null}" \
	'.at = $at
	 | .event = $event
	 | (if $phase == "" then . else .phase = $phase end)
	 | (if $ball == "" then . else .ball = $ball end)
	 | (if $round == "" then . else .round = ($round | tonumber) end)
	 | (if $note == "" then . else .note = $note end)
	 | (if $owner == "" then . else .owner = $owner end)
	 | (if $pd == "" then . else .packagesDerived = ($pd == "true") end)
	 | (if $pkgs == null then . else .packages = $pkgs end)
	 | (if $mailIn == "" then . else .lastMail = ((.lastMail // {}) + {in: $mailIn}) end)
	 | (if $mailOut == "" then . else .lastMail = ((.lastMail // {}) + {out: $mailOut}) end)
	 | (if $prRepo == "" then . else .upstream = ((.upstream // {}) + {pr: ((.upstream.pr // {}) + {repo: $prRepo, number: ($prNum | tonumber)})}) end)' \
	<<< "$PREV")

jq -e 'type == "object" and has("role") and has("phase") and has("ball")' >/dev/null 2>&1 <<< "$NEXT" \
	|| { echo "journal-append: composed line failed validation; nothing appended" >&2; exit 1; }

printf '%s\n' "$NEXT" >> "$JOURNAL"
echo "journal-append: appended $EVENT (phase=$(jq -r '.phase' <<< "$NEXT") ball=$(jq -r '.ball' <<< "$NEXT"))"

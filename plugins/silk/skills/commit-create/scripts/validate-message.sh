#!/usr/bin/env bash
# validate-message.sh — pre-flight validation for a candidate commit message.
# Bundled with the commit-create skill.
#
# Problem this solves: an agent composes a commit message, calls
# `git commit`, and the husky `commit-msg` hook rejects it AFTER lint-staged
# has already run (tens of seconds of biome/markdownlint/chmod over every
# staged file). The agent then re-guesses, often failing the SAME rule again,
# because commitlint's own violation text does not say which line tripped a
# max-line-length rule or by how much — and an LLM cannot reliably eyeball a
# 300-character limit. This script moves validation to before `git commit` is
# even invoked, and turns "guess" into "measure": under a second, no
# lint-staged cycle.
#
# Decision authority: the REAL @savvy-web/commitlint preset, invoked exactly
# as the commit-msg hook invokes it (same config file, same `--edit` mode,
# same package-manager runner: see .husky/commit-msg). Pass/fail here is
# never decided by a hand-rolled reimplementation of a commitlint rule — a
# hand-rolled copy would drift from the preset the moment either side
# changes. Everything below the "real commitlint preset" line is diagnostic
# only, run BEFORE it, to make failures actionable on the first retry.
#
# The measured thresholds below (HEADER_MAX / BODY_MAX / FOOTER_MAX) mirror
# the current repo config:
#   - HEADER_MAX=100  <- @commitlint/config-conventional `header-max-length`
#                        (lib/configs/commitlint.config.ts extends it, does
#                        not override it)
#   - BODY_MAX=300    <- packages/silk-effects/src/commitlint/config/rules.ts
#                        DEFAULT_BODY_MAX_LINE_LENGTH, applied via
#                        packages/silk-effects/src/commitlint/config/factory.ts
#                        `body-max-line-length`
#   - FOOTER_MAX=100  <- @commitlint/config-conventional
#                        `footer-max-line-length` (also not overridden — this
#                        applies to every trailer line, including
#                        `Signed-off-by:` and `Closes #N`, and is easy to
#                        miss since nothing else in this skill mentions it)
# If any of those source values ever change, the *decision* below stays
# correct because it comes from the real commitlint invocation; only these
# diagnostic labels could go stale, and this comment says so.
#
# Usage:
#   bash validate-message.sh <path-to-candidate-commit-message-file>
#
# Exit codes:
#   0 — commitlint accepted the message.
#   1 — commitlint rejected the message, or a usage/environment error.
#       (This is a plain CLI script, not a hook — exit 1 is an ordinary
#       failure signal here, not the hook "non-blocking" convention.)

set -euo pipefail

usage() {
	echo "Usage: validate-message.sh <path-to-candidate-commit-message-file>" >&2
}

MSG_FILE="${1:-}"
if [ -z "$MSG_FILE" ]; then
	usage
	exit 1
fi
if [ ! -f "$MSG_FILE" ]; then
	echo "ERROR: message file not found: $MSG_FILE" >&2
	exit 1
fi
if [ ! -s "$MSG_FILE" ]; then
	echo "ERROR: message file is empty: $MSG_FILE" >&2
	exit 1
fi

# Three-tier project root resolution (skill-scripts convention): the
# namespaced session var, then the host-provided project dir, then a
# standalone-invocation fallback.
PROJECT_DIR="${SILK_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
if [ ! -d "$PROJECT_DIR" ]; then
	echo "ERROR: project dir not found: $PROJECT_DIR" >&2
	exit 1
fi
cd "$PROJECT_DIR"

CONFIG_PATH="lib/configs/commitlint.config.ts"
if [ ! -f "$CONFIG_PATH" ]; then
	echo "ERROR: commitlint config not found at $CONFIG_PATH (expected repo layout)" >&2
	exit 1
fi

PM="npm"
if [ -f package.json ] && command -v jq >/dev/null 2>&1; then
	pm_field=$(jq -r '.packageManager // empty' package.json 2>/dev/null | cut -d'@' -f1 || true)
	[ -n "$pm_field" ] && PM="$pm_field"
fi
if [ "$PM" = "npm" ]; then
	if [ -f pnpm-lock.yaml ]; then
		PM=pnpm
	elif [ -f yarn.lock ]; then
		PM=yarn
	elif [ -f bun.lock ]; then
		PM=bun
	fi
fi
case "$PM" in
	pnpm) CMD=(pnpm exec commitlint) ;;
	yarn) CMD=(yarn exec commitlint) ;;
	bun) CMD=(bunx commitlint) ;;
	*) CMD=(npx --no -- commitlint) ;;
esac

# --- Diagnostic pass: measure every line, report exact numbers -------------

HEADER_MAX=100
BODY_MAX=300
FOOTER_MAX=100
TRAILER_RE='^([A-Za-z][A-Za-z0-9-]*: |Closes #|Fixes #|Resolves #|Closes: #|Fixes: #|Resolves: #)'

mapfile -t LINES <"$MSG_FILE"
total=${#LINES[@]}

echo "==> Measuring line lengths (diagnostic only — pass/fail is decided by commitlint below)"

violations=0
report_violation() {
	local kind="$1" line_no="$2" len="$3" limit="$4" preview="$5"
	violations=$((violations + 1))
	if [ "${#preview}" -gt 70 ]; then
		preview="${preview:0:70}…"
	fi
	printf 'MEASURED VIOLATION: %s line %d is %d chars (limit %d): %s\n' \
		"$kind" "$line_no" "$len" "$limit" "$preview" >&2
}

header="${LINES[0]:-}"
header_len=${#header}
if [ "$header_len" -gt "$HEADER_MAX" ]; then
	report_violation "header" 1 "$header_len" "$HEADER_MAX" "$header"
fi

# Identify the trailing trailer (footer) block: trailer-shaped lines at the
# end of the message, working backward from the last non-blank line.
# Everything after the header that is NOT part of this block is measured
# against the body limit instead.
#
# Blank lines INSIDE the block do not end it. The house format separates the
# Closes line from Signed-off-by with a blank line for readability, and
# commitlint accepts that; if a blank line ended the scan here, only the
# signoff would be measured and an over-long `Closes #a, #b, #c…` line would
# be checked against the body's 300 cap instead of the footer's 100 — the
# diagnostic would stay silent and the commit-msg hook would reject it later.
footer_start=-1
if [ "$total" -gt 1 ]; then
	idx=$((total - 1))
	while [ "$idx" -ge 0 ] && [ -z "${LINES[$idx]}" ]; do
		idx=$((idx - 1))
	done
	scan=$idx
	while [ "$scan" -ge 1 ]; do
		line="${LINES[$scan]}"
		if [[ "$line" =~ $TRAILER_RE ]]; then
			footer_start=$scan
			scan=$((scan - 1))
			continue
		fi
		# A blank line only continues the scan once the block has started, and
		# only if a trailer precedes it — otherwise the blank line separating
		# the body from the footer would swallow the whole body.
		if [ -z "$line" ] && [ "$footer_start" -ge 0 ] && [ "$scan" -ge 2 ] &&
			[[ "${LINES[$((scan - 1))]}" =~ $TRAILER_RE ]]; then
			scan=$((scan - 1))
			continue
		fi
		break
	done
fi

body_max_seen=0
body_max_line=0
footer_max_seen=0
footer_max_line=0

if [ "$total" -gt 1 ]; then
	for ((idx = 1; idx < total; idx++)); do
		line="${LINES[$idx]}"
		len=${#line}
		[ "$len" -eq 0 ] && continue
		if [ "$footer_start" -ge 0 ] && [ "$idx" -ge "$footer_start" ]; then
			if [ "$len" -gt "$footer_max_seen" ]; then
				footer_max_seen=$len
				footer_max_line=$((idx + 1))
			fi
			if [ "$len" -gt "$FOOTER_MAX" ]; then
				report_violation "footer" "$((idx + 1))" "$len" "$FOOTER_MAX" "$line"
			fi
		else
			if [ "$len" -gt "$body_max_seen" ]; then
				body_max_seen=$len
				body_max_line=$((idx + 1))
			fi
			if [ "$len" -gt "$BODY_MAX" ]; then
				report_violation "body" "$((idx + 1))" "$len" "$BODY_MAX" "$line"
			fi
		fi
	done
fi

printf 'Header: %d/%d chars.\n' "$header_len" "$HEADER_MAX"
if [ "$body_max_line" -gt 0 ]; then
	printf 'Body: longest line %d/%d chars (line %d).\n' "$body_max_seen" "$BODY_MAX" "$body_max_line"
else
	echo "Body: no body lines."
fi
if [ "$footer_max_line" -gt 0 ]; then
	printf 'Footer: longest line %d/%d chars (line %d).\n' "$footer_max_seen" "$FOOTER_MAX" "$footer_max_line"
else
	echo "Footer: no trailer lines detected."
fi

if [ "$violations" -gt 0 ]; then
	echo ""
	echo "Fix the measured violations above, then re-run this script before retrying commitlint." >&2
fi

# --- Authoritative pass: the real commitlint preset -------------------------

echo ""
echo "==> Running the real commitlint preset (${CMD[*]} --config $CONFIG_PATH --edit $MSG_FILE)"
if "${CMD[@]}" --config "$CONFIG_PATH" --edit "$MSG_FILE"; then
	echo ""
	echo "PASS: commit message satisfies the @savvy-web/commitlint preset."
	exit 0
else
	rc=$?
	echo ""
	echo "FAIL: commitlint rejected this message (see violations above). Fix and re-run this script — do not run git commit yet." >&2
	exit "$rc"
fi

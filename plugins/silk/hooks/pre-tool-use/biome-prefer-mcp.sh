#!/usr/bin/env bash
set -euo pipefail

# PreToolUse (matcher: Bash) — when the agent runs Biome via Bash, directly or
# through a package.json script, nudge it toward mcp__savvy-mcp__biome_check.
# NEVER blocks: emits additionalContext only (no permissionDecision), so the
# command always proceeds and the escape hatch is preserved. Nudges at most once
# per session.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

_HOOK="pre-tool-use/biome-prefer-mcp"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

ENVELOPE=$(cat)
COMMAND=$(echo "$ENVELOPE" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && { emit_noop; exit 0; }

is_biome=0

# 1. Direct invocation: `biome`, `/path/to/biome`, `pnpm exec biome`, `npx biome`.
#    Word-boundary match avoids coincidental substrings (paths containing "biome").
if echo "$COMMAND" | grep -Eq '(^|[[:space:]/])biome([[:space:]]|$)'; then
	is_biome=1
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
		root="${CLAUDE_PROJECT_DIR:-$(echo "$ENVELOPE" | jq -r '.cwd // empty')}"
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

NUDGE="You're about to run Biome via Bash. Prefer the mcp__savvy-mcp__biome_check tool: it returns structured diagnostics and can apply fixes (write/unsafe). If you already tried the MCP tool and it failed, or you need a flag it doesn't expose, ignore this and proceed — this is a one-time nudge, not a block."

emit_context "PreToolUse" "$NUDGE"
exit 0

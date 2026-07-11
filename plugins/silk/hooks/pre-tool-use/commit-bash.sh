#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="pre-tool-use/bash"

if ! command -v jq >/dev/null 2>&1; then
  hook_error "$_HOOK" "jq not found; skipping"
  emit_noop
  exit 0
fi

read_envelope_or_noop "$_HOOK"
ENVELOPE="$HOOK_ENVELOPE"
COMMAND=$(jq -r '.tool_input.command // empty' <<< "$ENVELOPE")
[ -z "$COMMAND" ] && exit 0

# Hot path — auto-allow safe commands. The hard exclusions inside
# match-safe-bash.sh deny any compound script containing `git commit` or
# `gh pr create|edit`, so those always fall through to the cold path.
if bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/match-safe-bash.sh" "$COMMAND"; then
  emit_allow "auto-allowed safe Bash: $(echo "$COMMAND" | head -c 60)"
  exit 0
fi

# Cold path — pre-commit-message check via CLI. stdout of the CLI flows
# directly through to the host (the JSON envelope is the decision signal).
# CLI failures are logged via hook_error and the script falls through to
# exit 0, so a broken CLI never blocks the agent (fail-open).
if bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/is-commit-related.sh" "$COMMAND"; then
  RUN=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-cli.sh")
  err=$(mktemp -t silk-commit-pre-bash.XXXXXX)
  trap 'rm -f "$err"' EXIT
  if ! echo "$ENVELOPE" | $RUN savvy commit hook pre-commit-message 2>"$err"; then
    hook_error "$_HOOK" "savvy commit hook pre-commit-message failed: $(tr '\n' ' ' < "$err")"
  fi
fi
exit 0

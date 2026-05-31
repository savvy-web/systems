#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

if ! command -v jq >/dev/null 2>&1; then
  hook_error "user-prompt-submit" "jq not found; skipping"
  exit 0
fi

ENVELOPE=$(cat)
PROMPT=$(echo "$ENVELOPE" | jq -r '.prompt // empty')
[ -z "$PROMPT" ] && exit 0

# Trigger commit-related guidance when the prompt mentions a commit-adjacent
# verb. `\bfinalize\b` already matches `/finalize` because `/` is a non-word
# character that forms a word boundary — no separate `/finalize` alternative
# needed.
if echo "$PROMPT" | grep -iqE '(\bcommit\b|\bcommitting\b|\bship (it|this)\b|\bwrap (it )?up\b|\b(create|open) a (pr|pull request)\b|\bfinalize\b|\bsquash\b|\bamend\b)'; then
  RUN=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-cli.sh")
  err=$(mktemp -t silk-commit-user-prompt.XXXXXX)
  trap 'rm -f "$err"' EXIT
  if ! echo "$ENVELOPE" | $RUN savvy commit hook user-prompt-submit 2>"$err"; then
    hook_error "user-prompt-submit" "savvy commit hook user-prompt-submit failed: $(tr '\n' ' ' < "$err")"
  fi
fi
exit 0

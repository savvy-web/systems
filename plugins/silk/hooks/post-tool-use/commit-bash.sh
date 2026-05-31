#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

if ! command -v jq >/dev/null 2>&1; then
  hook_error "post-tool-use/bash" "jq not found; skipping"
  exit 0
fi

ENVELOPE=$(cat)
COMMAND=$(echo "$ENVELOPE" | jq -r '.tool_input.command // empty')
INTERRUPTED=$(echo "$ENVELOPE" | jq -r '.tool_response.interrupted // false')

[ -z "$COMMAND" ] && exit 0
[ "$INTERRUPTED" = "true" ] && exit 0

if ! bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/is-commit-related.sh" "$COMMAND"; then
  exit 0
fi

RUN=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-cli.sh")
err=$(mktemp -t silk-commit-post-bash.XXXXXX)
trap 'rm -f "$err"' EXIT
if ! echo "$ENVELOPE" | $RUN savvy commit hook post-commit-verify 2>"$err"; then
  hook_error "post-tool-use/bash" "savvy commit hook post-commit-verify failed: $(tr '\n' ' ' < "$err")"
fi
exit 0

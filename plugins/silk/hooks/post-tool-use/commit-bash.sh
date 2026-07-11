#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="post-tool-use/bash"

if ! command -v jq >/dev/null 2>&1; then
  hook_error "$_HOOK" "jq not found; skipping"
  exit 0
fi

read_envelope_or_noop "$_HOOK"
ENVELOPE="$HOOK_ENVELOPE"
COMMAND=$(jq -r '.tool_input.command // empty' <<< "$ENVELOPE")
INTERRUPTED=$(jq -r '.tool_response.interrupted // false' <<< "$ENVELOPE")

[ -z "$COMMAND" ] && exit 0
[ "$INTERRUPTED" = "true" ] && exit 0

if ! bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/is-commit-related.sh" "$COMMAND"; then
  exit 0
fi

RUN=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-cli.sh")
err=$(mktemp -t silk-commit-post-bash.XXXXXX)
trap 'rm -f "$err"' EXIT
if ! echo "$ENVELOPE" | $RUN savvy commit hook post-commit-verify 2>"$err"; then
  hook_error "$_HOOK" "savvy commit hook post-commit-verify failed: $(tr '\n' ' ' < "$err")"
fi
exit 0

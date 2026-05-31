#!/usr/bin/env bash
set -euo pipefail

# Drain stdin first so a producer pipe never blocks on us, even if a later
# guard short-circuits the script.
cat > /dev/null

# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

trap 'hook_error "session-start" "failed at line $LINENO (exit $?)"; exit 1' ERR

if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
  hook_error "session-start" "CLAUDE_PROJECT_DIR is not set"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  hook_error "session-start" "jq not found on PATH; skipping context injection"
  exit 0
fi

RUN=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-cli.sh")
err=$(mktemp -t silk-commit-session-start.XXXXXX)
trap 'rm -f "$err"' EXIT
if ! $RUN savvy commit hook session-start 2>"$err"; then
  hook_error "session-start" "savvy commit hook session-start failed: $(tr '\n' ' ' < "$err")"
  exit 0
fi

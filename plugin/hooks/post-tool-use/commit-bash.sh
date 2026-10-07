#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook (matcher: Bash): after a commit-related command (git commit,
# gh pr create|edit) finishes, run `savvy commit hook post-commit-verify` and
# relay its advice (commitlint failure, unsigned commit, missing Closes trailer)
# as additionalContext. Never blocks; a broken CLI is logged and ignored.

# shellcheck source=../lib/pluginfinity/hook.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
# shellcheck source=../lib/silk/hook-env.sh
. "$(dirname "$0")/../lib/silk/hook-env.sh"

hook_require_input
COMMAND=$(hook_input tool_input.command)
INTERRUPTED=$(hook_input tool_response.interrupted)

[ -z "$COMMAND" ] && exit 0
[ "$INTERRUPTED" = "true" ] && exit 0

if ! bash "${SILK_HOOK_LIB}/is-commit-related.sh" "$COMMAND"; then
	exit 0
fi

# Copilot runs hooks from the plugin root; the CLI must run in the project.
hook_cd_project || true
RUN=$(silk_cli_runner)
ENVELOPE=$(hook_envelope claude)
err=$(mktemp -t silk-commit-post-bash.XXXXXX)
out=""
if ! out=$(printf '%s\n' "$ENVELOPE" | $RUN savvy commit hook post-commit-verify 2>"$err"); then
	hook_log "savvy commit hook post-commit-verify failed: $(tr '\n' ' ' <"$err")"
fi
rm -f "$err"
# Empty CLI output relays as a no-op; non-JSON output is logged by hook_relay
# and answered with a no-op here.
hook_relay "$out" || hook_noop

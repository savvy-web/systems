#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (matcher: Bash): auto-approve safe commands, and check the
# message of a commit-related command (git commit, gh pr create|edit) against
# the commitlint contract through `savvy commit hook pre-commit-message`.

# shellcheck source=../lib/pluginfinity/hook.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
# shellcheck source=../lib/silk/hook-env.sh
. "$(dirname "$0")/../lib/silk/hook-env.sh"

hook_require_input
COMMAND=$(hook_input tool_input.command)
[ -z "$COMMAND" ] && exit 0

# Hot path — auto-allow safe commands. The hard exclusions inside
# match-safe-bash.sh deny any compound script containing `git commit` or
# `gh pr create|edit`, so those always fall through to the cold path.
if bash "${SILK_HOOK_LIB}/match-safe-bash.sh" "$COMMAND"; then
	hook_allow "auto-allowed safe Bash: $(printf '%s' "$COMMAND" | head -c 60)"
	exit 0
fi

# Cold path — pre-commit-message check via CLI. The CLI answers in Claude
# Code's shape; hook_relay re-emits it for the running host. CLI
# failures are logged and the hook falls through to a no-op, so a broken CLI
# never blocks the agent (fail-open).
if bash "${SILK_HOOK_LIB}/is-commit-related.sh" "$COMMAND"; then
	hook_cd_project || true
	RUN=$(silk_cli_runner)
	ENVELOPE=$(hook_envelope claude)
	err=$(mktemp -t silk-commit-pre-bash.XXXXXX)
	out=""
	if ! out=$(printf '%s\n' "$ENVELOPE" | $RUN savvy commit hook pre-commit-message 2>"$err"); then
		hook_log "savvy commit hook pre-commit-message failed: $(tr '\n' ' ' <"$err")"
	fi
	rm -f "$err"
	# Empty CLI output relays as a no-op; non-JSON output is logged by
	# hook_relay and answered with a no-op here.
	hook_relay "$out" || hook_noop
fi
exit 0

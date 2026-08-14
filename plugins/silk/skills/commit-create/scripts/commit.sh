#!/usr/bin/env bash
# commit.sh — the ONLY sanctioned way to turn a candidate commit message
# file into an actual commit. Bundled with the commit-create skill.
#
# Why this exists (read before "just calling git commit directly"):
#
# A validator that only REPORTS violations is not enough. Observed in this
# session, three times: the agent ran a length check, the check correctly
# printed a violation, and `git commit` ran anyway — because the check and
# the commit were two separate, unconditional commands. Seeing a violation
# and proceeding is the actual bug, not miscounting characters. Chaining
# them with `&&` in one Bash call fixes it in theory, but still requires the
# agent to remember to write `&&` instead of two calls, every single time.
#
# This script removes that choice. It validates the message file against
# the real commitlint preset (see validate-message.sh) and ONLY on success
# execs the real `git commit -F <file>`. There is no "then commit anyway"
# step available, because git commit is never reached unless validation
# already exited 0 inside this same process.
#
# Usage:
#   bash commit.sh <path-to-message-file>                 # plain commit
#   bash commit.sh <path-to-message-file> -- <git args>    # passthrough
#
# Examples:
#   bash commit.sh /tmp/msg.txt                # git commit -F /tmp/msg.txt
#   bash commit.sh /tmp/msg.txt -- --amend      # git commit -F /tmp/msg.txt --amend
#   bash commit.sh /tmp/msg.txt -- -S           # git commit -F /tmp/msg.txt -S
#
# `--no-verify` is refused outright: it would skip lint-staged and the
# commit-msg hook for the ACTUAL commit, defeating the point of this script
# even though this script's own validation already ran commitlint once.
#
# Exit codes:
#   0 — commit created.
#   1 — validation failed (nothing committed) or a usage/environment error.
#   Any other code — propagated from `git commit` itself (e.g. nothing
#   staged), once validation has already passed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ${CLAUDE_PLUGIN_ROOT} is set by the host for every Bash-tool invocation of a
# bundled skill script. The dirname-walk fallback is ONLY for standalone
# invocation outside Claude Code (skill-scripts convention) — three levels up
# from skills/commit-create/scripts is the plugin root.
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "${SCRIPT_DIR}/../../.." && pwd)}"
# shellcheck source=../../../hooks/lib/resolve-cli-project-dir.sh
. "${PLUGIN_ROOT}/hooks/lib/resolve-cli-project-dir.sh"

usage() {
	echo "Usage: commit.sh <path-to-message-file> [-- git commit args...]" >&2
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
shift

GIT_ARGS=()
if [ "${1:-}" = "--" ]; then
	shift
	GIT_ARGS=("$@")
fi

for arg in "${GIT_ARGS[@]+"${GIT_ARGS[@]}"}"; do
	if [ "$arg" = "--no-verify" ] || [ "$arg" = "-n" ]; then
		echo "ERROR: --no-verify/-n is refused by commit.sh. It would skip lint-staged and the commit-msg hook for the real commit. If you believe a hook is wrong, fix the hook — do not bypass it." >&2
		exit 1
	fi
done

# Resolve MSG_FILE to an absolute path BEFORE any `cd` below — it is very
# likely a relative path from the caller's cwd, and validate-message.sh (run
# as a child process) and the final `git commit` (run after this script's
# own `cd`) must both resolve the SAME file regardless of which directory
# they end up running in.
case "$MSG_FILE" in
	/*) : ;;
	*) MSG_FILE="$(pwd)/$MSG_FILE" ;;
esac

if ! bash "${SCRIPT_DIR}/validate-message.sh" "$MSG_FILE"; then
	echo "" >&2
	echo "COMMIT BLOCKED: the message above failed validation. Nothing was committed." >&2
	echo "Fix the message file and re-run commit.sh. Do not call git commit directly to work around this — that is the exact failure mode this script exists to prevent." >&2
	exit 1
fi

# Same cwd-first project root resolution as validate-message.sh (see
# resolve-cli-project-dir.sh for the full rationale). This `cd` is
# load-bearing: without it, `git commit` below runs in WHATEVER directory
# this script happened to be invoked from — not necessarily the repo the
# staged changes live in — and can silently operate on the wrong git
# repository. validate-message.sh resolving its OWN copy of PROJECT_DIR in
# its own subshell does not help this script's `git commit`, which runs
# after that subshell has already exited.
PROJECT_DIR=$(resolve_cli_project_dir) || exit 1
if [ ! -d "$PROJECT_DIR" ]; then
	echo "ERROR: project dir not found: $PROJECT_DIR" >&2
	exit 1
fi
cd "$PROJECT_DIR"

exec git commit -F "$MSG_FILE" "${GIT_ARGS[@]+"${GIT_ARGS[@]}"}"

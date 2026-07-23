# shellcheck shell=bash
# test_helper.bash — shared BATS helper for plugins/github-actions hook tests.
#
# Load from a .bats file with:
#   load 'test_helper'
#
# Exposes PLUGIN_ROOT / HOOKS_DIR and a common_setup function that isolates
# HOME per-test so hook logs never touch the real developer home directory,
# and strips leaked CLAUDE_* env so a suite run from inside a live Claude Code
# session stays hermetic.

# shellcheck disable=SC2034  # HOOKS_DIR is used by the .bats files that
# `load` this helper, not within this file itself.
PLUGIN_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
HOOKS_DIR="${PLUGIN_ROOT}/hooks"

common_setup() {
	# Real CLAUDE_PLUGIN_ROOT — hooks source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/..."
	export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"

	# Hermetic env.
	unset CLAUDE_PROJECT_DIR CLAUDE_ENV_FILE

	# Isolate HOME so nothing under the real ~/.claude or ~/.local/state is
	# touched by a test run.
	export HOME="${BATS_TEST_TMPDIR}/home"
	mkdir -p "$HOME"

	# Pin the hook-debug / hook-error logs into the throwaway tree as well.
	export GITHUB_ACTIONS_HOOK_ERROR_LOG="${BATS_TEST_TMPDIR}/hook-errors.log"
	export GITHUB_ACTIONS_HOOK_DEBUG_LOG="${BATS_TEST_TMPDIR}/hook-debug.log"
}

# test_helper.bash — shared BATS helper for plugins/silk hook tests.
#
# Load from a .bats file with:
#   load 'test_helper'
#
# Exposes PLUGIN_ROOT / HOOKS_DIR / FIXTURES_DIR and a common_setup function
# that isolates HOME per-test so hooks that write session-marker files under
# ~/.claude/session-env/ never touch the real developer home directory.

# shellcheck disable=SC2034  # HOOKS_DIR / FIXTURES_DIR are used by the .bats
# files that `load` this helper, not within this file itself.
PLUGIN_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
HOOKS_DIR="${PLUGIN_ROOT}/hooks"
FIXTURES_DIR="${HOOKS_DIR}/fixtures"

common_setup() {
	# Real CLAUDE_PLUGIN_ROOT — hooks source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/..."
	export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"

	# Isolate HOME so the once-per-session marker file
	# (~/.claude/session-env/<session_id>/biome-prefer-mcp.nudged) is written
	# under a throwaway directory instead of the real developer home.
	export HOME="${BATS_TEST_TMPDIR}/home"
	mkdir -p "$HOME"
}

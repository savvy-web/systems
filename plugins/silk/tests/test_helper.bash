# shellcheck shell=bash
# test_helper.bash — shared BATS helper for plugins/silk hook tests.
#
# Load from a .bats file with:
#   load 'test_helper'
#
# Exposes PLUGIN_ROOT / HOOKS_DIR / FIXTURES_DIR and a common_setup function
# that isolates HOME per-test so hooks that write session-marker files under
# ~/.claude never touch the real developer home directory, and strips any
# leaked SILK_*/CLAUDE_* env so a suite run from inside a live silk-plugin
# session stays hermetic.

# shellcheck disable=SC2034  # HOOKS_DIR / FIXTURES_DIR are used by the .bats
# files that `load` this helper, not within this file itself.
PLUGIN_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
HOOKS_DIR="${PLUGIN_ROOT}/hooks"
FIXTURES_DIR="${HOOKS_DIR}/fixtures"

common_setup() {
	# Real CLAUDE_PLUGIN_ROOT — hooks source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/..."
	export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"

	# Hermetic env. When `bats` runs inside a live silk-plugin Claude Code
	# session, its SessionStart hook exports SILK_PACKAGE_MANAGER,
	# SILK_PROJECT_DIR, ... into the shell. Left in place, a hook under test
	# would resolve the developer's real package manager / project dir instead
	# of the isolated fixtures — e.g. the changeset-validate hook would shell
	# out to the workspace's real `savvy` CLI. Strip them all.
	unset SILK_PROJECT_DIR SILK_DATA_DIR SILK_PLUGIN_ROOT SILK_SESSION_ID \
		SILK_PACKAGE_MANAGER SILK_SKIP_PUSH_CHECK \
		CLAUDE_PROJECT_DIR CLAUDE_ENV_FILE

	# Isolate HOME so the once-per-session marker file
	# (~/.claude/session-env/<session_id>/biome-prefer-mcp.nudged), the
	# per-session env file, and hook logs are written under a throwaway
	# directory instead of the real developer home.
	export HOME="${BATS_TEST_TMPDIR}/home"
	mkdir -p "$HOME"

	# Pin the hook-debug / hook-error logs into the throwaway tree as well, so
	# a test run never appends to ~/.local/state/silk/*.log.
	export SILK_HOOK_ERROR_LOG="${BATS_TEST_TMPDIR}/hook-errors.log"
	export SILK_HOOK_DEBUG_LOG="${BATS_TEST_TMPDIR}/hook-debug.log"
}

# use_stub_bin — prepend a per-test stub dir to PATH so fake CLI runners
# (npx, pnpm, savvy) intercept a hook's shell-outs. Real tools (jq, git, bash)
# still resolve because the stub dir is only PREPENDED. Pair with
# force_npm_runner so hooks resolve their runner to `npx`, the token this
# suite stubs.
use_stub_bin() {
	STUB_BIN="${BATS_TEST_TMPDIR}/stub-bin"
	mkdir -p "$STUB_BIN"
	export PATH="${STUB_BIN}:${PATH}"
}

# write_stub <name> — install an executable <name> into the stub dir, reading
# its script body from stdin. Requires use_stub_bin first.
write_stub() {
	local dest="${STUB_BIN}/${1}"
	cat > "$dest"
	chmod +x "$dest"
}

# force_npm_runner — pin package-manager resolution (for both run-cli.sh and the
# changeset-validate hook) to npm, so every CLI shell-out becomes
# `npx --no -- ...`. That is the single runner token this suite stubs. Callers
# must still point CLAUDE_PROJECT_DIR at a dir with no package.json/lockfile
# (e.g. via make_project) so run-cli.sh, which ignores SILK_PACKAGE_MANAGER,
# also falls back to npm.
force_npm_runner() {
	export SILK_PACKAGE_MANAGER=npm
}

# make_project — create an empty throwaway project dir, export
# CLAUDE_PROJECT_DIR to it, and echo the path. With no package.json/lockfile the
# CLI runner resolvers fall back to npm (-> `npx`), which this suite stubs.
make_project() {
	local proj="${BATS_TEST_TMPDIR}/project"
	mkdir -p "$proj"
	export CLAUDE_PROJECT_DIR="$proj"
	echo "$proj"
}

# init_push_repo — create a throwaway git repo with a committed `main` branch
# and a checked-out `feature` branch, export CLAUDE_PROJECT_DIR to it, and echo
# the path. The changeset-push-guard suite layers per-scenario commits on top.
init_push_repo() {
	local repo="${BATS_TEST_TMPDIR}/repo"
	mkdir -p "$repo"
	git -C "$repo" init -q -b main
	git -C "$repo" config user.email test@example.com
	git -C "$repo" config user.name "Silk Test"
	echo root > "$repo/README.md"
	git -C "$repo" add README.md
	git -C "$repo" commit -q -m "chore: root commit"
	git -C "$repo" checkout -q -b feature
	export CLAUDE_PROJECT_DIR="$repo"
	echo "$repo"
}

# repo_commit <repo> <message> <path> [content] — write a file and commit it on
# the current branch. Used to build "has changeset" / "no changeset" states.
repo_commit() {
	local repo="$1" msg="$2" path="$3" content="${4:-x}"
	mkdir -p "$(dirname "${repo}/${path}")"
	printf '%s\n' "$content" > "${repo}/${path}"
	git -C "$repo" add "$path"
	git -C "$repo" commit -q -m "$msg"
}

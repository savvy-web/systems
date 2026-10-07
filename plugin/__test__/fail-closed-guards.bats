#!/usr/bin/env bats
# __test__/fail-closed-guards.bats
#
# The guards that must not fail open carry `failClosed: true` in
# pluginfinity.config.ts: biome-direct-deny, repos-bash-guard, repos-mcp-guard,
# repos-fs-guard and both dogfood-guard entries. The build writes that as
# PLUGINFINITY_FAIL_CLOSED=1 into the entry's environment (Claude: an `env K=V`
# prefix in args; Copilot: the entry's `env` object), and the hook library turns
# a crash into a PreToolUse deny.
#
# pluginfinity's run_hook applies the environment of the BUILT entry that runs
# the script, so a crash test exercises the config and the library together.
# The first test still reads each entry's environment straight from the built
# hooks file (entry_env), so the guard set is pinned independently of the
# helper. The crash is a broken install: a scratch copy of the build whose
# hooks/lib/silk/hook-env.sh fails when sourced, after the library's EXIT trap
# is in place. Every input is one the guard would normally let through, so a
# deny can only come from the crash.

load common

GUARD_MATCHER_MCP='mcp__(gk|gitkraken|GitKraken)__.*|mcp__github(-[^_].*)?__.*'

# entry_env <script> <matcher> — print the built entry's VAR=value pairs, one
# per line, for the current target.
entry_env() {
	local script="$1" matcher="$2"
	case "$SILK_TARGET" in
		claude)
			jq -r --arg s "$script" --arg m "$matcher" '
				.hooks.PreToolUse[] | select(.matcher == $m) | .hooks[]
				| select((.args // []) | last | endswith($s))
				| .args[] | select(test("^[A-Z_]+="))' "$PLUGIN_DIR/builds/claude/hooks/hooks.json"
			;;
		copilot)
			jq -r --arg s "$script" --arg m "$matcher" '
				.hooks.PreToolUse[] | select(.matcher == $m and (.bash | contains($s)))
				| .env | to_entries[] | "\(.key)=\(.value)"' \
				"$PLUGIN_DIR/builds/copilot/com.github.copilot/hooks/hooks.json"
			;;
	esac
}

# broken_build — a copy of the current target's build whose silk helper fails
# when sourced. Prints the plugin dir to hand to run_hook.
broken_build() {
	local dir="${SILK_TMP}/broken"
	mkdir -p "${dir}/builds"
	cp -R "$PLUGIN_DIR/builds/$SILK_TARGET" "${dir}/builds/"
	printf 'false\n' >"${dir}/builds/${SILK_TARGET}/hooks/lib/silk/hook-env.sh"
	echo "$dir"
}

# crash_run <script> <fixture> [--matcher <m>] [VAR=value...] — run <script>
# from a broken copy of the build through run_hook, which supplies the built
# entry's environment. dogfood-guard.sh runs under two entries; --matcher picks
# one.
crash_run() {
	local broken
	broken="$(broken_build)"
	PLUGIN_DIR="$broken" silk_run "$@"
}

expect_fail_closed_deny() {
	[ "$status" -eq 0 ]
	[ "$(_decision)" = "deny" ]
	[[ "$(_reason)" == "silk hook failed (exit 1)" ]]
	grep -q "exited 1 during PreToolUse" "$SILK_ERROR_LOG"
}

@test "the six guarded entries, and only those, carry PLUGINFINITY_FAIL_CLOSED=1" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local s
	for s in biome-direct-deny.sh repos-bash-guard.sh dogfood-guard.sh; do
		entry_env "hooks/pre-tool-use/$s" Bash | grep -qx 'PLUGINFINITY_FAIL_CLOSED=1'
	done
	for s in repos-mcp-guard.sh dogfood-guard.sh; do
		entry_env "hooks/pre-tool-use/$s" "$GUARD_MATCHER_MCP" | grep -qx 'PLUGINFINITY_FAIL_CLOSED=1'
	done
	entry_env hooks/pre-tool-use/repos-fs-guard.sh 'Write|Edit|NotebookEdit' | grep -qx 'PLUGINFINITY_FAIL_CLOSED=1'
	# Advisory hooks stay fail-open.
	! entry_env hooks/pre-tool-use/commit-bash.sh Bash | grep -q FAIL_CLOSED
	! entry_env hooks/pre-tool-use/biome-prefer-mcp.sh Bash | grep -q FAIL_CLOSED
	! entry_env hooks/pre-tool-use/commit-mcp.sh "$GUARD_MATCHER_MCP" | grep -q FAIL_CLOSED
	! entry_env hooks/pre-tool-use/commit-fs.sh 'Read|Write|Edit' | grep -q FAIL_CLOSED
	done
}

@test "Bash guard (biome-direct-deny): a crash denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	crash_run hooks/pre-tool-use/biome-direct-deny.sh "${FIXTURES_DIR}/pretooluse.bash-safe.json"
	expect_fail_closed_deny
	done
}

@test "Bash guard (repos-bash-guard): a crash denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	crash_run hooks/pre-tool-use/repos-bash-guard.sh "${FIXTURES_DIR}/pretooluse.bash-safe.json"
	expect_fail_closed_deny
	done
}

@test "Bash guard (dogfood-guard, Bash entry): a crash denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	crash_run hooks/pre-tool-use/dogfood-guard.sh "${FIXTURES_DIR}/pretooluse.bash-safe.json" --matcher Bash
	expect_fail_closed_deny
	done
}

@test "MCP guard (repos-mcp-guard): a crash denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	crash_run hooks/pre-tool-use/repos-mcp-guard.sh "${FIXTURES_DIR}/pretooluse.mcp-github-read.json"
	expect_fail_closed_deny
	done
}

@test "MCP guard (dogfood-guard, MCP entry): a crash denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	crash_run hooks/pre-tool-use/dogfood-guard.sh "${FIXTURES_DIR}/pretooluse.mcp-github-read.json" --matcher "$GUARD_MATCHER_MCP"
	expect_fail_closed_deny
	done
}

@test "FS guard (repos-fs-guard): a crash denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	crash_run hooks/pre-tool-use/repos-fs-guard.sh "${FIXTURES_DIR}/pretooluse.repos-fs-outside.json"
	expect_fail_closed_deny
	done
}

# Controls: the same crash fails OPEN when the entry's fail policy is overridden
# to 0, and on an advisory hook that is not fail-closed, so the deny above is
# the config's doing.
@test "control: the same crash with PLUGINFINITY_FAIL_CLOSED=0 fails open" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	crash_run hooks/pre-tool-use/repos-fs-guard.sh "${FIXTURES_DIR}/pretooluse.repos-fs-outside.json" PLUGINFINITY_FAIL_CLOSED=0
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	grep -q "exited 1 during PreToolUse" "$SILK_ERROR_LOG"
	done
}

@test "control: an advisory hook (commit-bash) that crashes fails open" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	crash_run hooks/pre-tool-use/commit-bash.sh "${FIXTURES_DIR}/pretooluse.bash-safe.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	grep -q "exited 1 during PreToolUse" "$SILK_ERROR_LOG"
	done
}

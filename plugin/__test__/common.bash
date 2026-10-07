# shellcheck shell=bash
# shellcheck disable=SC2034 # FIXTURES_DIR, HOOKS_DIR and the log paths are read by the .bats files.
# shellcheck disable=SC2154 # $output and $stderr are set by bats' `run`.
# shellcheck disable=SC2016 # the bash -c bodies expand their own positional args.
# common.bash — shared bats helper for the silk plugin's pluginfinity suite.
#
# Every suite runs against the BUILT plugin under builds/<target>/, never the
# source, so run `pluginfinity build` first (the run-tests.sh runner does).
#
# Each @test runs once per target in SILK_TARGETS (default "claude copilot"):
#
#   @test "..." {
#   	for SILK_TARGET in $SILK_TARGETS; do
#   		silk_setup "$SILK_TARGET"
#   		...
#   	done
#   }
#
# silk_setup gives every target its own scratch tree ($SILK_TMP), HOME, state
# directory and PATH, then calls the file's silk_file_setup when it defines
# one. A failure prints the target it happened on.
#
# Hooks run through pluginfinity's run_hook (env -i, the host's environment,
# Copilot from the plugin root) via silk_run, which passes the test's own
# environment through: stub PATH, SILK_* variables, and, on Claude Code only,
# CLAUDE_PROJECT_DIR / CLAUDE_ENV_FILE / CLAUDE_PLUGIN_DATA.

# shellcheck source=/dev/null
load "$BATS_TEST_DIRNAME/../node_modules/pluginfinity/bats/pluginfinity.bash"

: "${SILK_TARGETS:=claude copilot}"
SILK_ORIG_PATH="$PATH"
FIXTURES_DIR="$PLUGIN_DIR/__test__/fixtures"

# silk_setup <target> — reset per-target state and select the build.
silk_setup() {
	SILK_TARGET="$1"
	echo "--- target: $SILK_TARGET"
	SILK_TMP="${BATS_TEST_TMPDIR}/${SILK_TARGET}"
	rm -rf "$SILK_TMP"
	mkdir -p "$SILK_TMP"
	PLUGIN_ROOT="$PLUGIN_DIR/builds/$SILK_TARGET"
	HOOKS_DIR="$PLUGIN_ROOT/hooks"
	export PATH="$SILK_ORIG_PATH"
	cd "$SILK_TMP" || return 1
	common_setup
	if declare -F silk_file_setup >/dev/null; then
		silk_file_setup
	fi
}

# common_setup — hermetic environment for the current target. Idempotent.
common_setup() {
	unset SILK_PROJECT_DIR SILK_DATA_DIR SILK_PLUGIN_ROOT SILK_SESSION_ID \
		SILK_PACKAGE_MANAGER SILK_SKIP_CHANGESET_NUDGE \
		CLAUDE_PROJECT_DIR CLAUDE_ENV_FILE CLAUDE_PLUGIN_DATA CLAUDE_PLUGIN_ROOT \
		TERM_PROGRAM LC_TERMINAL
	export HOME="${SILK_TMP}/home"
	mkdir -p "$HOME"
	export XDG_STATE_HOME="${SILK_TMP}/state"
	# The pluginfinity log standard: error.log always, debug.log only under
	# PLUGINFINITY_DEBUG=1.
	SILK_ERROR_LOG="${XDG_STATE_HOME}/pluginfinity/silk/error.log"
	SILK_DEBUG_LOG="${XDG_STATE_HOME}/pluginfinity/silk/debug.log"
	# Only a script a test runs directly (node "$MONITOR", node "$SCRIPT") sees
	# this; run_hook, run_script and run_monitor build their own environment.
	if [ "$SILK_TARGET" = claude ]; then
		export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
	fi
}

# silk_run <script> <fixture-file> [--matcher <m>] [--session-env <file>]
# [--env-wait] [VAR=value...] — run a built hook for the current target. Sets
# $status, $output (stdout) and $stderr.
#
# run_hook applies the environment of the built entry that runs <script>
# (PLUGINFINITY_EVENT, and PLUGINFINITY_FAIL_CLOSED=1 on the six guards);
# trailing VAR=value arguments override it. A script under several entries
# (dogfood-guard.sh: Bash and MCP) takes --matcher <m>, the entry's exact
# matcher string. --session-env <file> seeds the session values the hook sees
# (as if the env runner had run), and --env-wait keeps a SessionStart reader's
# real wait for the runner; both pass straight to run_hook.
#
# Copilot always reports the tool call's cwd and never sets
# CLAUDE_PROJECT_DIR, so on copilot a fixture without a cwd gets the test's
# CLAUDE_PROJECT_DIR as its cwd, and CLAUDE_PROJECT_DIR itself is withheld.
silk_run() {
	local script="$1" fixture="$2"
	shift 2
	local -a opts=()
	while [ $# -gt 0 ]; do
		case "$1" in
			--matcher | --session-env)
				opts+=("$1" "$2")
				shift 2
				;;
			--env-wait)
				opts+=("$1")
				shift
				;;
			*) break ;;
		esac
	done
	local -a pass=(PATH="$PATH" HOME="$HOME" XDG_STATE_HOME="$XDG_STATE_HOME")
	local var
	while IFS= read -r var; do
		pass+=("${var}=${!var}")
	done < <(compgen -e | grep -E '^(SILK_|TERM_PROGRAM$|LC_TERMINAL$|GIT_)' || true)
	SILK_HOOK_EVENT=$(jq -r '.hook_event_name // empty' "$fixture" 2>/dev/null || true)
	if [ "$SILK_TARGET" = claude ]; then
		pass+=(CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}")
		[ -n "${CLAUDE_ENV_FILE:-}" ] && pass+=(CLAUDE_ENV_FILE="$CLAUDE_ENV_FILE")
		[ -n "${CLAUDE_PLUGIN_DATA:-}" ] && pass+=(CLAUDE_PLUGIN_DATA="$CLAUDE_PLUGIN_DATA")
	elif [ -n "${CLAUDE_PROJECT_DIR:-}" ] && jq -e 'type == "object" and (has("cwd") | not)' "$fixture" >/dev/null 2>&1; then
		local copy
		copy="${SILK_TMP}/copilot-$(basename "$fixture")-$RANDOM.json"
		jq --arg d "$CLAUDE_PROJECT_DIR" '.cwd = $d' "$fixture" >"$copy"
		fixture="$copy"
	fi
	run_hook "$SILK_TARGET" "$script" "$fixture" ${opts[@]+"${opts[@]}"} "${pass[@]}" "$@"
}

# silk_run_stdin <script> <text> [event] — run a built hook with literal
# (possibly malformed) stdin text. run_hook reads the event from its fixture
# with jq, so a non-JSON payload cannot go through it; this mirrors run_hook's
# environment for both hosts. Since pluginfinity 0.3.0 the build sets
# PLUGINFINITY_EVENT on every entry of BOTH hosts (Claude entries are written
# `env PLUGINFINITY_EVENT=<event> bash <script>`), which [event] stands in for.
silk_run_stdin() {
	local script="$1" text="$2" root="$PLUGIN_DIR/builds/$SILK_TARGET"
	SILK_HOOK_EVENT="${3:-}"
	case "$SILK_TARGET" in
		claude)
			run --separate-stderr env -i PATH="$PATH" HOME="$HOME" XDG_STATE_HOME="$XDG_STATE_HOME" \
				CLAUDE_PLUGIN_ROOT="$root" CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}" \
				PLUGINFINITY_EVENT="$SILK_HOOK_EVENT" \
				bash -c 'printf "%s" "$1" | bash "$2"' _ "$text" "$root/$script"
			;;
		copilot)
			run --separate-stderr env -i PATH="$PATH" HOME="$HOME" XDG_STATE_HOME="$XDG_STATE_HOME" \
				PLUGIN_ROOT="$root" PLUGINFINITY_EVENT="$SILK_HOOK_EVENT" \
				bash -c 'cd "$1" && printf "%s" "$2" | bash "$3"' _ "$root" "$text" "$root/$script"
			;;
	esac
}

# silk_script <path> [args...] — run a built skill script for the current
# target through pluginfinity's run_script, from the test's current directory
# (--cwd "$PWD": the agent runs a skill script from its own cwd, which is what
# the scripts resolve their repository from). The test's environment goes in
# as --env options: PATH (stubs), HOME, XDG_STATE_HOME, and every SILK_* and
# GIT_* variable. No project variable is passed on either host: a skill script
# run through the Bash tool gets none (on Claude Code run_script adds only
# CLAUDE_CODE_SESSION_ID=test-session). A test that models a caller setting
# CLAUDE_PROJECT_DIR passes `--env CLAUDE_PROJECT_DIR=...` itself, before the
# script's own arguments. Sets $status, $output (stdout) and $stderr.
silk_script() {
	local path="$1"
	shift
	local -a envs=(--env PATH="$PATH" --env HOME="$HOME" --env XDG_STATE_HOME="$XDG_STATE_HOME")
	local var
	while IFS= read -r var; do
		envs+=(--env "${var}=${!var}")
	done < <(compgen -e | grep -E '^(SILK_|GIT_)' || true)
	run_script "$SILK_TARGET" "$path" --cwd "$PWD" "${envs[@]}" "$@"
}

# Response accessors, reading either host's shape.
_decision() { jq -r '.hookSpecificOutput.permissionDecision // .permissionDecision // empty' <<<"$output"; }
_reason() { jq -r '.hookSpecificOutput.permissionDecisionReason // .permissionDecisionReason // empty' <<<"$output"; }
_context() { jq -r '.hookSpecificOutput.additionalContext // .additionalContext // empty' <<<"$output"; }

# silk_supports <capability> [event] — mirrors the hook library's table for the
# current target (see the hook-events skill).
silk_supports() {
	local cap="$1" event="${2:-$SILK_HOOK_EVENT}"
	case "$SILK_TARGET:$cap:$event" in
		claude:context:SessionStart | claude:context:PreToolUse | claude:context:PostToolUse | claude:context:Stop) return 0 ;;
		claude:system_message:SessionStart | claude:system_message:PreToolUse | claude:system_message:PostToolUse | claude:system_message:Stop) return 0 ;;
		copilot:context:SessionStart | copilot:context:PostToolUse) return 0 ;;
		*:deny:PreToolUse | *:allow:PreToolUse) return 0 ;;
	esac
	return 1
}

# expect_context_contains <text> — context with <text> where the target
# honours context on this event; a no-op everywhere else.
expect_context_contains() {
	if silk_supports context; then
		[[ "$(_context)" == *"$1"* ]] || {
			echo "context lacks '$1': $output" >&2
			return 1
		}
	else
		assert_hook_noop
	fi
}

# expect_system_message_contains <text> — Claude Code only; Copilot has no
# systemMessage and answers {}.
expect_system_message_contains() {
	if silk_supports system_message; then
		[[ "$(jq -r '.systemMessage // empty' <<<"$output")" == *"$1"* ]] || {
			echo "systemMessage lacks '$1': $output" >&2
			return 1
		}
	else
		assert_hook_noop
	fi
}

# expect_event_name <name> — Claude Code nests hookEventName; Copilot's flat
# shape has none.
expect_event_name() {
	if [ "$SILK_TARGET" = claude ]; then
		[ "$(jq -r '.hookSpecificOutput.hookEventName' <<<"$output")" = "$1" ]
	fi
}

# use_stub_bin — prepend a per-target stub dir to PATH so fake CLI runners
# (npx, pnpm, savvy) intercept a hook's shell-outs.
use_stub_bin() {
	STUB_BIN="${SILK_TMP}/stub-bin"
	mkdir -p "$STUB_BIN"
	export PATH="${STUB_BIN}:${PATH}"
}

# write_stub <name> — install an executable <name> into the stub dir, reading
# its body from stdin. Requires use_stub_bin first.
write_stub() {
	local dest="${STUB_BIN}/${1}"
	cat >"$dest"
	chmod +x "$dest"
}

# force_npm_runner — pin package-manager resolution to npm, so every CLI
# shell-out becomes `npx --no -- ...`, the runner token the suite stubs.
force_npm_runner() {
	export SILK_PACKAGE_MANAGER=npm
}

# make_project — create an empty throwaway project dir, export
# CLAUDE_PROJECT_DIR to it, and echo the path.
make_project() {
	local proj="${SILK_TMP}/project"
	mkdir -p "$proj"
	export CLAUDE_PROJECT_DIR="$proj"
	echo "$proj"
}

# make_repo_project — make_project, then `git init` it, and echo the path.
#
# The hook library's hook_project_dir walks an absolute input cwd up to the
# nearest .git, else takes the cwd as given (pluginfinity round 2; round 1
# discarded a non-git cwd, which is why the hook suites moved to this). Real
# silk projects are git repositories, so the hook suites keep using it; the
# non-git case has its own tests (commit-fs, startup-only, orientation).
make_repo_project() {
	make_project >/dev/null
	git -C "$CLAUDE_PROJECT_DIR" init -q -b main
	echo "$CLAUDE_PROJECT_DIR"
}

# init_push_repo — throwaway git repo with a committed `main` and a checked-out
# `feature` branch; exports CLAUDE_PROJECT_DIR to it and echoes the path.
init_push_repo() {
	local repo="${SILK_TMP}/repo"
	mkdir -p "$repo"
	git -C "$repo" init -q -b main
	git -C "$repo" config user.email test@example.com
	git -C "$repo" config user.name "Silk Test"
	echo root >"$repo/README.md"
	git -C "$repo" add README.md
	git -C "$repo" commit -q -m "chore: root commit"
	git -C "$repo" checkout -q -b feature
	export CLAUDE_PROJECT_DIR="$repo"
	echo "$repo"
}

# repo_commit <repo> <message> <path> [content] — write a file and commit it.
repo_commit() {
	local repo="$1" msg="$2" path="$3" content="${4:-x}"
	mkdir -p "$(dirname "${repo}/${path}")"
	printf '%s\n' "$content" >"${repo}/${path}"
	git -C "$repo" add "$path"
	git -C "$repo" commit -q -m "$msg"
}

# envelope_with_cwd <fixture> [dir] — copy <fixture> with .cwd set to <dir>
# (default: $CLAUDE_PROJECT_DIR) and echo the copy's path.
envelope_with_cwd() {
	local fixture="$1"
	local dir="${2:-${CLAUDE_PROJECT_DIR:-}}"
	local out
	out="${SILK_TMP}/envelope-$(basename "$fixture")"
	jq --arg d "$dir" '.cwd = $d' "$fixture" >"$out"
	echo "$out"
}

# envelope_without_cwd <fixture> — copy <fixture> with .cwd deleted.
envelope_without_cwd() {
	local fixture="$1"
	local out
	out="${SILK_TMP}/envelope-nocwd-$(basename "$fixture")"
	jq 'del(.cwd)' "$fixture" >"$out"
	echo "$out"
}

# add_worktree <repo> <branch> — a git worktree of <repo> on a NEW branch.
add_worktree() {
	local repo="$1" branch="$2"
	local wt="${SILK_TMP}/wt-${branch//\//-}"
	git -C "$repo" worktree add -q -b "$branch" "$wt" main
	echo "$wt"
}

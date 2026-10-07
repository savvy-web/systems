#!/usr/bin/env bats
# __test__/session-start-orientation.bats
#
# Coverage for hooks/session-start/orientation.sh: on every session start, emit
# SessionStart additionalContext with the <silk_capabilities> surface (MCP
# tool, agent, and skill indexes).
#
# The hook no longer produces any session state. The SILK_* session variables
# are declared in pluginfinity.config.ts (`env`) and resolved by the generated
# runner, lib/pluginfinity/env-run.sh, with scripts/env-setup.sh detecting
# SILK_PACKAGE_MANAGER; session-start-env.bats covers that chain. The tests
# here pin that the hook writes no env file and leaves CLAUDE_ENV_FILE alone.
#
# No CLI shell-out — this hook is pure jq, so it needs no stubs.

load common

HOOK="hooks/session-start/orientation.sh"

silk_file_setup() {
	common_setup
}

@test "emits SessionStart context with the orientation payload" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	expect_event_name SessionStart
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	[[ "$ctx" == *"silk_capabilities"* ]]
	[[ "$ctx" == *"workspace_info"* ]]
	[[ "$ctx" == *"biome_check"* ]]
	[[ "$ctx" == *"changeset_inspect"* ]]
	[[ "$ctx" == *"/silk:commit-create"* ]]
	[[ "$ctx" == *"/silk:dogfood"* ]]
	# The MCP prefix is the host's own (hook_tool_prefix savvy-mcp); the monitors
	# and the it2 skill are named only where the build ships them (hook_has),
	# which is Claude Code only.
	if [ "$SILK_TARGET" = claude ]; then
		[[ "$ctx" == *'prefix="mcp__plugin_silk_savvy-mcp__"'* ]]
		[[ "$ctx" == *"dogfood-mail"* ]]
		[[ "$ctx" == *"/silk:it2"* ]]
	else
		[[ "$ctx" == *'prefix="savvy-mcp-"'* ]]
		[[ "$ctx" != *"mcp__plugin_silk"* ]]
		[[ "$ctx" != *"monitors"* ]]
		[[ "$ctx" != *"it2"* ]]
	fi
	done
}

@test "writes no session state: no session-env file, CLAUDE_ENV_FILE untouched, no values file" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	export CLAUDE_ENV_FILE="${SILK_TMP}/claude-env.sh"
	: > "$CLAUDE_ENV_FILE"
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	expect_event_name SessionStart
	[ -n "$(_context)" ]
	# The old hand-rolled export file and its CLAUDE_ENV_FILE copies are gone;
	# the generated runner owns both now.
	[ ! -e "${HOME}/.claude/session-env" ]
	[ ! -s "$CLAUDE_ENV_FILE" ]
	[ ! -e "${XDG_STATE_HOME}/pluginfinity/silk/session/sess-orient-1/env" ]
	done
}

# savvy-mcp cannot learn the project on Copilot: the server starts at the
# plugin root, the client offers no roots, and no variable names the project
# (pluginfinity's server_project_dir returns 1 there). Every tool takes an
# optional cwd, so the Copilot orientation tells the model to always pass it.
# On Claude Code the launcher reads CLAUDE_PROJECT_DIR, and the text must stay
# byte-identical to plugins/silk: the tool index ends on the schema line.
@test "savvy-mcp cwd: Copilot is told to always pass cwd; Claude text unchanged" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(_context)"
	if [ "$SILK_TARGET" = copilot ]; then
		[[ "$ctx" == *"ALWAYS pass cwd (the absolute path of the project root) to every savvy-mcp"* ]]
		[[ "$ctx" == *$'cannot\n  find the project on its own'* ]]
		[[ "$ctx" == *$'inspects the wrong tree.\n</mcp_tools>'* ]]
	else
		[[ "$ctx" != *"ALWAYS pass cwd"* ]]
		[[ "$ctx" == *$'  Parameter and mode detail lives on each tool\'s schema.\n</mcp_tools>'* ]]
	fi
	done
}

# A cwd that no longer exists (stale envelope, deleted worktree) still yields
# a live session: the hook needs no project to orient.
@test "nonexistent project dir: context still emitted" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json" "${SILK_TMP}/gone")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	expect_event_name SessionStart
	[[ "$(_context)" == *"silk_capabilities"* ]]
	done
}

@test "no session_id: still emits context" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local envelope="${SILK_TMP}/no-sid.json"
	jq --arg d "$CLAUDE_PROJECT_DIR" 'del(.session_id) | .cwd = $d' \
		"${FIXTURES_DIR}/sessionstart.orientation.json" > "$envelope"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	expect_event_name SessionStart
	[[ "$(_context)" == *"silk_capabilities"* ]]
	done
}

@test "malformed JSON input: no-op (fails open)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	silk_run_stdin "$HOOK" 'not json'
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

# it2 pane-orchestration gate (savvy-web/systems, 2026-07-21 design):
# TERMINAL_BLOCK renders only when TERM_PROGRAM/LC_TERMINAL say iTerm2 AND
# `it2` is on PATH. No it2 subprocess runs anywhere in the hook or these
# tests — a stub is enough since only `command -v it2` is exercised.

# path_without_it2 — echo $PATH with every component that contains an `it2`
# executable stripped, so the "it2 absent" scenario stays honest even on a
# dev machine that happens to have a real it2 installed (e.g. via `go
# install`), rather than depending on a hardcoded, environment-specific path.
path_without_it2() {
	local dir out=""
	local IFS=':'
	local -a dirs
	read -ra dirs <<< "$PATH"
	for dir in "${dirs[@]}"; do
		[ -x "${dir}/it2" ] && continue
		out="${out:+${out}:}${dir}"
	done
	printf '%s' "$out"
}

@test "it2 gate holds (TERM_PROGRAM=iTerm.app + stubbed it2): proactive terminal block present" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	use_stub_bin
	write_stub it2 <<'STUB'
#!/bin/sh
exit 0
STUB
	export TERM_PROGRAM=iTerm.app
	unset LC_TERMINAL
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	# The it2 skill ships to Claude Code only, so the block does too.
	if [ "$SILK_TARGET" != claude ]; then
		[[ "$ctx" != *"</terminal>"* ]]
		continue
	fi
	[[ "$ctx" == *"<terminal>"* ]]
	[[ "$ctx" == *"</terminal>"* ]]
	[[ "$ctx" == *"Proactively orchestrate"* ]]
	[[ "$ctx" == *"Dismiss subagents"* ]]
	[[ "$ctx" == *"/silk:it2"* ]]
	done
}

@test "it2 gate holds via LC_TERMINAL=iTerm2 (TERM_PROGRAM unset)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	use_stub_bin
	write_stub it2 <<'STUB'
#!/bin/sh
exit 0
STUB
	unset TERM_PROGRAM
	export LC_TERMINAL=iTerm2
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	if [ "$SILK_TARGET" = claude ]; then
		[[ "$ctx" == *"</terminal>"* ]]
	else
		[[ "$ctx" != *"</terminal>"* ]]
	fi
	done
}

@test "not in iTerm2 (TERM_PROGRAM unset): no terminal block, clean single blank line" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	unset TERM_PROGRAM LC_TERMINAL
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	# Assert against the CLOSING tag / body text, not the bare word "<terminal>"
	# — the always-on skill index mentions "<terminal>" in prose (pointing at
	# this gated block), so that substring alone is present in every case.
	[[ "$ctx" != *"</terminal>"* ]]
	[[ "$ctx" != *"Proactively orchestrate"* ]]
	[[ "$ctx" == *$'</biome>\n\n<active_hooks>'* ]]
	done
}

@test "TERM_PROGRAM set to something other than iTerm.app: no terminal block" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	export TERM_PROGRAM=vscode
	unset LC_TERMINAL
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	# Assert against the CLOSING tag / body text, not the bare word "<terminal>"
	# — the always-on skill index mentions "<terminal>" in prose (pointing at
	# this gated block), so that substring alone is present in every case.
	[[ "$ctx" != *"</terminal>"* ]]
	[[ "$ctx" != *"Proactively orchestrate"* ]]
	done
}

@test "in iTerm2 but it2 absent from PATH: no terminal block" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	export TERM_PROGRAM=iTerm.app
	unset LC_TERMINAL
	export PATH
	PATH="$(path_without_it2)"
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	# Assert against the CLOSING tag / body text, not the bare word "<terminal>"
	# — the always-on skill index mentions "<terminal>" in prose (pointing at
	# this gated block), so that substring alone is present in every case.
	[[ "$ctx" != *"</terminal>"* ]]
	[[ "$ctx" != *"Proactively orchestrate"* ]]
	done
}

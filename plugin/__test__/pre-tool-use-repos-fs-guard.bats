#!/usr/bin/env bats
# __test__/pre-tool-use-repos-fs-guard.bats
#
# Coverage for hooks/pre-tool-use/repos-fs-guard.sh: deny Write / Edit /
# NotebookEdit into "${PROJECT_DIR}/.repos/**" (vendored, read-only reference
# source). ".repos/config.json" is the one hand-editable exception. Everything
# else exits 0 silently. Paths are resolved relative to the project dir
# (hook_project_dir: envelope .cwd walked up to its .git > CLAUDE_PROJECT_DIR)
# when not absolute.
#
# This is the first suite covering emit_deny (hook-output.sh) end to end --
# see tests/README.md "Deny-path fixture pattern" for what future deny hooks
# should copy from here.

load common

HOOK="hooks/pre-tool-use/repos-fs-guard.sh"

silk_file_setup() {
	common_setup
}

_decision() {
	jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision) // empty' <<< "$1"
}

_reason() {
	jq -r '(.hookSpecificOutput.permissionDecisionReason // .permissionDecisionReason) // empty' <<< "$1"
}

# rewrite_project_dir <fixture> <project> — copy a fixture into a per-test
# envelope with the __PROJECT_DIR__ placeholder substituted for the real
# throwaway project path, and echo the envelope path.
rewrite_project_dir() {
	local fixture="$1" project="$2"
	local envelope="${SILK_TMP}/envelope.json"
	jq --arg d "$project" \
		'(.tool_input.file_path? // "") as $f
		 | (.tool_input.notebook_path? // "") as $n
		 | if $f != "" then .tool_input.file_path = ($f | gsub("__PROJECT_DIR__"; $d))
		   elif $n != "" then .tool_input.notebook_path = ($n | gsub("__PROJECT_DIR__"; $d))
		   else . end' \
		"$fixture" > "$envelope"
	echo "$envelope"
}

@test "Write into .repos tree (absolute path): deny naming repos_manage / savvy repos" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	# make_repo_project >/dev/null, not `project="$(make_project)"` — command
	# substitution runs the function in a subshell, so its
	# `export CLAUDE_PROJECT_DIR=...` never reaches this test process. Call
	# directly so the export lands here, then read it back.
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	local envelope; envelope="$(rewrite_project_dir "${FIXTURES_DIR}/pretooluse.repos-fs-deny.json" "$project")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"repos_manage"* ]]
	[[ "$reason" == *"savvy repos"* ]]
	done
}

@test "Edit .repos/config.json (relative path): silent no-op (the hand-editable exception)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.repos-fs-config-allow.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "Write outside .repos (relative path): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.repos-fs-outside.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "NotebookEdit notebook_path under .repos (absolute path): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	local envelope; envelope="$(rewrite_project_dir "${FIXTURES_DIR}/pretooluse.repos-fs-notebook.json" "$project")"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "relative file_path resolved against project dir: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local envelope="${SILK_TMP}/relative-deny.json"
	jq '.tool_input.file_path = ".repos/effect/src/x.ts"' \
		"${FIXTURES_DIR}/pretooluse.repos-fs-outside.json" > "$envelope"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

# hook_project_dir never comes back empty: with no cwd and no
# CLAUDE_PROJECT_DIR it resolves $PWD (walked up to a .git), so there is no
# "missing project dir" branch any more. A write outside .repos/ stays silent.
@test "no envelope cwd, CLAUDE_PROJECT_DIR unset: write outside .repos is a no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	unset CLAUDE_PROJECT_DIR
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.repos-fs-outside.json"
	assert_hook_noop
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

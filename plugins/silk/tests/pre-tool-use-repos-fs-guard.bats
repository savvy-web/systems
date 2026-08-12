#!/usr/bin/env bats
# tests/pre-tool-use-repos-fs-guard.bats
#
# Coverage for hooks/pre-tool-use/repos-fs-guard.sh: deny Write / Edit /
# NotebookEdit into "${PROJECT_DIR}/.repos/**" (vendored, read-only reference
# source). ".repos/config.json" is the one hand-editable exception. Everything
# else exits 0 silently. Paths are resolved relative to the project dir
# (resolve_project_dir: envelope .cwd > SILK_PROJECT_DIR > CLAUDE_PROJECT_DIR)
# when not absolute.
#
# This is the first suite covering emit_deny (hook-output.sh) end to end --
# see tests/README.md "Deny-path fixture pattern" for what future deny hooks
# should copy from here.

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/repos-fs-guard.sh"

setup() {
	common_setup
}

_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

_reason() {
	jq -r '.hookSpecificOutput.permissionDecisionReason // empty' <<< "$1"
}

# rewrite_project_dir <fixture> <project> — copy a fixture into a per-test
# envelope with the __PROJECT_DIR__ placeholder substituted for the real
# throwaway project path, and echo the envelope path.
rewrite_project_dir() {
	local fixture="$1" project="$2"
	local envelope="${BATS_TEST_TMPDIR}/envelope.json"
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
	# make_project >/dev/null, not `project="$(make_project)"` — command
	# substitution runs the function in a subshell, so its
	# `export CLAUDE_PROJECT_DIR=...` never reaches this test process. Call
	# directly so the export lands here, then read it back.
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	local envelope; envelope="$(rewrite_project_dir "${FIXTURES_DIR}/pretooluse.repos-fs-deny.json" "$project")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"repos_manage"* ]]
	[[ "$reason" == *"savvy repos"* ]]
}

@test "Edit .repos/config.json (relative path): silent no-op (the hand-editable exception)" {
	make_project >/dev/null
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-fs-config-allow.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "Write outside .repos (relative path): silent no-op" {
	make_project >/dev/null
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-fs-outside.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "NotebookEdit notebook_path under .repos (absolute path): deny" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	local envelope; envelope="$(rewrite_project_dir "${FIXTURES_DIR}/pretooluse.repos-fs-notebook.json" "$project")"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "relative file_path resolved against project dir: deny" {
	make_project >/dev/null
	local envelope="${BATS_TEST_TMPDIR}/relative-deny.json"
	jq '.tool_input.file_path = ".repos/effect/src/x.ts"' \
		"${FIXTURES_DIR}/pretooluse.repos-fs-outside.json" > "$envelope"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "missing project dir (no envelope cwd, CLAUDE_PROJECT_DIR unset): no-op (fails open)" {
	unset CLAUDE_PROJECT_DIR
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-fs-outside.json' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "malformed JSON input: no-op (fails open)" {
	make_project >/dev/null
	run bash -c "printf 'not json' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

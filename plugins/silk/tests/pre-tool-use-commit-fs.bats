#!/usr/bin/env bats
# tests/pre-tool-use-commit-fs.bats
#
# Coverage for hooks/pre-tool-use/commit-fs.sh: auto-allow Read|Write|Edit on
# paths under "${CLAUDE_PROJECT_DIR}/.claude/cache/". Everything else exits 0
# silently. Paths are resolved relative to CLAUDE_PROJECT_DIR when not absolute.

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/commit-fs.sh"

setup() {
	common_setup
	# The hook dereferences ${CLAUDE_PROJECT_DIR} unconditionally under `set -u`
	# (both in the relative-path join and in the cache-path case pattern), so a
	# value must be present for any file_path.
	export CLAUDE_PROJECT_DIR="${BATS_TEST_TMPDIR}/project"
	mkdir -p "$CLAUDE_PROJECT_DIR"
}

_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

@test "relative path under .claude/cache/: allow" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.fs-cache-relative.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	[[ "$output" == *"auto-allowed plugin cache path"* ]]
}

@test "absolute path under .claude/cache/: allow" {
	local envelope="${BATS_TEST_TMPDIR}/abs-cache.json"
	jq --arg p "${CLAUDE_PROJECT_DIR}/.claude/cache/data.json" \
		'.tool_input.file_path = $p' \
		"${FIXTURES_DIR}/pretooluse.fs-cache-relative.json" > "$envelope"
	run bash -c "cat '${envelope}' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
}

@test "path outside the cache (src/index.ts): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.fs-noncache.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "absolute path outside the cache: silent no-op" {
	local envelope="${BATS_TEST_TMPDIR}/abs-noncache.json"
	jq --arg p "${CLAUDE_PROJECT_DIR}/src/main.ts" \
		'.tool_input.file_path = $p' \
		"${FIXTURES_DIR}/pretooluse.fs-noncache.json" > "$envelope"
	run bash -c "cat '${envelope}' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "missing file_path: silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.fs-empty.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "malformed JSON input: non-zero exit (jq parse error), no decision emitted" {
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -ne 0 ]
	[ -z "$output" ]
}

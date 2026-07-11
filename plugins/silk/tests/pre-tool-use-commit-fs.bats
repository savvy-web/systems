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

@test "malformed JSON input: no-op (fails open)" {
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

# savvy-web/systems#270: the hook used to dereference ${CLAUDE_PROJECT_DIR}
# unguarded under `set -u`, so an unset variable aborted with an
# unbound-variable error instead of failing open like every other hook.
@test "CLAUDE_PROJECT_DIR unset, no envelope cwd: no-op (fails open)" {
	unset CLAUDE_PROJECT_DIR
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.fs-cache-relative.json' | '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "CLAUDE_PROJECT_DIR unset, absolute path: no-op (fails open, no abort)" {
	unset CLAUDE_PROJECT_DIR
	local envelope="${BATS_TEST_TMPDIR}/abs-no-projectdir.json"
	jq --arg p "/somewhere/.claude/cache/data.json" '.tool_input.file_path = $p' \
		"${FIXTURES_DIR}/pretooluse.fs-cache-relative.json" > "$envelope"
	run bash -c "cat '${envelope}' | '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

# With CLAUDE_PROJECT_DIR absent, the envelope's cwd is enough to resolve the
# cache root — the worktree case from savvy-web/systems#274 applied to this hook.
@test "CLAUDE_PROJECT_DIR unset but envelope cwd present: resolves against cwd" {
	unset CLAUDE_PROJECT_DIR
	local root="${BATS_TEST_TMPDIR}/wt"
	mkdir -p "$root"
	local envelope="${BATS_TEST_TMPDIR}/cwd-cache.json"
	jq --arg d "$root" '.cwd = $d' \
		"${FIXTURES_DIR}/pretooluse.fs-cache-relative.json" > "$envelope"
	run bash -c "cat '${envelope}' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
}

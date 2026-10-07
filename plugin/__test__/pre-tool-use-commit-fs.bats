#!/usr/bin/env bats
# __test__/pre-tool-use-commit-fs.bats
#
# Coverage for hooks/pre-tool-use/commit-fs.sh: auto-allow Read|Write|Edit on
# paths under "${CLAUDE_PROJECT_DIR}/.claude/cache/". Everything else exits 0
# silently. Paths are resolved relative to CLAUDE_PROJECT_DIR when not absolute.

load common

HOOK="hooks/pre-tool-use/commit-fs.sh"

silk_file_setup() {
	common_setup
	# The hook dereferences ${CLAUDE_PROJECT_DIR} unconditionally under `set -u`
	# (both in the relative-path join and in the cache-path case pattern), so a
	# value must be present for any file_path.
	make_repo_project >/dev/null
}

_decision() {
	jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision) // empty' <<< "$1"
}

@test "relative path under .claude/cache/: allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.fs-cache-relative.json"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	# hook_allow carries the plugins/silk reason again (pluginfinity 0.3.0).
	[[ "$(_reason)" == "auto-allowed plugin cache path: "* ]]
	done
}

@test "absolute path under .claude/cache/: allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local envelope="${SILK_TMP}/abs-cache.json"
	jq --arg p "${CLAUDE_PROJECT_DIR}/.claude/cache/data.json" \
		'.tool_input.file_path = $p' \
		"${FIXTURES_DIR}/pretooluse.fs-cache-relative.json" > "$envelope"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	done
}

@test "path outside the cache (src/index.ts): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.fs-noncache.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "absolute path outside the cache: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local envelope="${SILK_TMP}/abs-noncache.json"
	jq --arg p "${CLAUDE_PROJECT_DIR}/src/main.ts" \
		'.tool_input.file_path = $p' \
		"${FIXTURES_DIR}/pretooluse.fs-noncache.json" > "$envelope"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "missing file_path: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.fs-empty.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "malformed JSON input: no-op (fails open)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run_stdin "$HOOK" 'not json'
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

# savvy-web/systems#270: the hook used to dereference ${CLAUDE_PROJECT_DIR}
# unguarded under `set -u`, so an unset variable aborted with an
# unbound-variable error instead of failing open like every other hook.
#
# hook_project_dir never comes back empty, so the old "no project dir: no-op"
# branch is gone: with no cwd and no CLAUDE_PROJECT_DIR it resolves $PWD (walked
# up to a .git). The #270 property this pins is the one that survives: no abort,
# exit 0, a well-formed answer. Neither host sends an input without cwd.
@test "CLAUDE_PROJECT_DIR unset, no envelope cwd: no abort (exit 0, valid answer)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	unset CLAUDE_PROJECT_DIR
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.fs-cache-relative.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ] || jq -e 'type == "object"' >/dev/null <<<"$output"
	[ "$(_decision "$output")" != "deny" ]
	done
}

@test "CLAUDE_PROJECT_DIR unset, absolute path: no-op (fails open, no abort)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	unset CLAUDE_PROJECT_DIR
	local envelope="${SILK_TMP}/abs-no-projectdir.json"
	jq --arg p "/somewhere/.claude/cache/data.json" '.tool_input.file_path = $p' \
		"${FIXTURES_DIR}/pretooluse.fs-cache-relative.json" > "$envelope"
	silk_run "$HOOK" "${envelope}"
	assert_hook_noop
	done
}

# With CLAUDE_PROJECT_DIR absent, the envelope's cwd is enough to resolve the
# cache root — the worktree case from savvy-web/systems#274 applied to this hook.
@test "CLAUDE_PROJECT_DIR unset but envelope cwd present: resolves against cwd" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	unset CLAUDE_PROJECT_DIR
	local root="${SILK_TMP}/wt"
	mkdir -p "$root"
	git -C "$root" init -q -b main
	local envelope="${SILK_TMP}/cwd-cache.json"
	jq --arg d "$root" '.cwd = $d' \
		"${FIXTURES_DIR}/pretooluse.fs-cache-relative.json" > "$envelope"
	silk_run "$HOOK" "${envelope}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "allow" ]
	done
}

# An absolute input cwd with no .git above it is the project as given, on both
# hosts (pluginfinity round 2), as plugins/silk had it. Before round 2 Copilot
# fell back to $PWD, the plugin root, and so to the repository holding the
# plugin (in this checkout: savvy-web/systems itself).
@test "non-git envelope cwd: resolves against that cwd, not the plugin's repo" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	unset CLAUDE_PROJECT_DIR
	local root="${SILK_TMP}/plain"
	mkdir -p "$root"
	local envelope="${SILK_TMP}/plain-cache.json"
	jq --arg d "$root" --arg p "${root}/.claude/cache/data.json" '.cwd = $d | .tool_input.file_path = $p' \
		"${FIXTURES_DIR}/pretooluse.fs-cache-relative.json" > "$envelope"
	silk_run "$HOOK" "${envelope}"
	[ "$(_decision "$output")" = "allow" ]
	done
}

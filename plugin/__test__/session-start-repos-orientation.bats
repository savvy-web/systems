#!/usr/bin/env bats
# __test__/session-start-repos-orientation.bats
#
# Coverage for hooks/session-start/repos-orientation.sh: on every session
# start, run `savvy repos sync` behind an internal watchdog (best-effort, the
# hook must complete well under the harness timeout even when sync hangs) and
# unconditionally inject a <vendored_repos> orientation block built from
# .repos/config.json (Task 1 schema). Sync NEVER gates the block -- on
# failure or timeout the block still renders, with a warning line.
#
# No fixture carries a "cwd" -- resolve_project_dir falls back to
# CLAUDE_PROJECT_DIR (exported by make_project), matching the pattern already
# used by the other repos-*-guard suites when worktree cwd precedence isn't
# under test.

load common

HOOK="hooks/session-start/repos-orientation.sh"

silk_file_setup() {
	common_setup
}

# write_manifest <project> <json> -- write .repos/config.json under <project>.
write_manifest() {
	local project="$1" json="$2"
	mkdir -p "${project}/.repos"
	printf '%s' "$json" > "${project}/.repos/config.json"
}

# stub_sync <exit-code|sleep-seconds> -- install a stub `npx` (this suite pins
# the CLI runner to npm via force_npm_runner) standing in for
# `savvy repos sync`.
stub_sync_exit() {
	local code="$1"
	use_stub_bin
	write_stub npx <<STUB
#!/usr/bin/env bash
exit ${code}
STUB
}

stub_sync_sleep() {
	local seconds="$1"
	use_stub_bin
	write_stub npx <<STUB
#!/usr/bin/env bash
sleep ${seconds}
exit 0
STUB
}

_ctx() {
	jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$1"
}

@test "two-repo manifest: additionalContext contains both names, purposes, a note line, and the tool-pointer line" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	force_npm_runner
	stub_sync_exit 0
	write_manifest "$project" '{
		"repos": {
			"repo-a": {
				"url": "https://example.com/repo-a.git",
				"ref": "main",
				"purpose": "purpose-of-repo-a",
				"orientation": {
					"layout": "layout-a",
					"startHere": "start-a",
					"keyPaths": { "src/index.ts": "entry point" }
				},
				"notes": [
					{ "id": "n-1", "date": "2026-07-12", "ref": "main", "note": "note-text-a" }
				]
			},
			"repo-b": {
				"url": "https://example.com/repo-b.git",
				"ref": "v1.0.0",
				"purpose": "purpose-of-repo-b"
			}
		}
	}'
	silk_run "$HOOK" "${FIXTURES_DIR}/sessionstart.repos.json"
	[ "$status" -eq 0 ]
	expect_event_name SessionStart
	local ctx; ctx="$(_ctx "$output")"
	[[ "$ctx" == *"repo-a"* ]]
	[[ "$ctx" == *"repo-b"* ]]
	[[ "$ctx" == *"purpose-of-repo-a"* ]]
	[[ "$ctx" == *"purpose-of-repo-b"* ]]
	[[ "$ctx" == *"note (n-1, main): note-text-a"* ]]
	[[ "$ctx" == *"repos_inspect to look, repos_manage to act"* ]]
	[[ "$ctx" == *"synced"* ]]
	done
}

@test "no manifest: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	force_npm_runner
	silk_run "$HOOK" "${FIXTURES_DIR}/sessionstart.repos.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "stubbed sync exits 1: context still emitted and contains the sync-failed line" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	force_npm_runner
	stub_sync_exit 1
	write_manifest "$project" '{
		"repos": {
			"repo-a": {
				"url": "https://example.com/repo-a.git",
				"ref": "main",
				"purpose": "purpose-of-repo-a"
			}
		}
	}'
	silk_run "$HOOK" "${FIXTURES_DIR}/sessionstart.repos.json"
	[ "$status" -eq 0 ]
	local ctx; ctx="$(_ctx "$output")"
	[[ "$ctx" == *"repo-a"* ]]
	[[ "$ctx" == *"sync failed"* ]]
	done
}

@test "sync sleeps past SILK_REPOS_SYNC_TIMEOUT: hook completes fast, context contains the failure line" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	force_npm_runner
	stub_sync_sleep 30
	export SILK_REPOS_SYNC_TIMEOUT=1
	write_manifest "$project" '{
		"repos": {
			"repo-a": {
				"url": "https://example.com/repo-a.git",
				"ref": "main",
				"purpose": "purpose-of-repo-a"
			}
		}
	}'
	local start end elapsed
	start=$(date +%s)
	silk_run "$HOOK" "${FIXTURES_DIR}/sessionstart.repos.json"
	end=$(date +%s)
	elapsed=$((end - start))
	[ "$status" -eq 0 ]
	[ "$elapsed" -lt 8 ]
	local ctx; ctx="$(_ctx "$output")"
	[[ "$ctx" == *"sync failed"* ]]
	done
}

@test "oversized repo plus a small repo: the small repo renders in one-line overflow form" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	force_npm_runner
	stub_sync_exit 0
	local huge; huge="$(printf 'x%.0s' $(seq 1 2500))"
	write_manifest "$project" "$(jq -n --arg huge "$huge" '{
		repos: {
			"repo-huge": {
				url: "https://example.com/repo-huge.git",
				ref: "main",
				purpose: "purpose-huge",
				orientation: { startHere: $huge }
			},
			"repo-small": {
				url: "https://example.com/repo-small.git",
				ref: "main",
				purpose: "purpose-of-repo-small"
			}
		}
	}')"
	silk_run "$HOOK" "${FIXTURES_DIR}/sessionstart.repos.json"
	[ "$status" -eq 0 ]
	local ctx; ctx="$(_ctx "$output")"
	[[ "$ctx" == *'- repo-small — purpose-of-repo-small (details: repos_inspect mode:"config")'* ]]
	done
}

@test "malformed JSON input: no-op (fails open)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	force_npm_runner
	silk_run_stdin "$HOOK" 'not json'
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

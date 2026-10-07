#!/usr/bin/env bats
# __test__/post-tool-use-changeset-validate-changeset.bats
#
# Coverage for hooks/post-tool-use/changeset-validate-changeset.sh: after a
# Write|Edit, if the file is a changeset (.changeset/<name>.md, excluding
# README.md), run `savvy changeset validate-file` and surface any findings as
# additionalContext. Never blocks.
#
# The CLI-touching paths pin the runner to npm and stub `npx` so the real
# savvy CLI installed in this workspace is never invoked (that non-determinism
# is exactly what the hermetic env in test_helper.bash guards against).

load common

HOOK="hooks/post-tool-use/changeset-validate-changeset.sh"

silk_file_setup() {
	common_setup
	make_repo_project >/dev/null
	force_npm_runner
}

# Stub `npx` (the npm runner) with a savvy simulator.
#   $1 = version_exit  : exit code for `... --version` (0 = CLI available)
#   $2 = validate_exit : exit code for `... validate-file` (non-zero = issues)
#   $3 = validate_out  : text the validate-file run prints
_stub_savvy() {
	use_stub_bin
	local ver="$1" val="$2" out="$3"
	write_stub npx <<STUB
#!/usr/bin/env bash
for a in "\$@"; do
	case "\$a" in
		--version) exit ${ver} ;;
		validate-file) printf '%s\n' "${out}"; exit ${val} ;;
	esac
done
exit 0
STUB
}

@test "non-changeset file (src/index.ts): no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_savvy 0 1 "should not run"
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.write-non-changeset.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test ".changeset/README.md: no-op (README is not a changeset)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_savvy 0 1 "should not run"
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.changeset-readme.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "missing file_path: no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_savvy 0 1 "should not run"
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.write-empty.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "changeset file, CLI unavailable (--version fails): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_savvy 1 1 "unreachable"
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.changeset-file.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "changeset file, validation FAILS: emits findings as additionalContext" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_savvy 0 1 "CSH001: section heading missing at line 3"
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.changeset-file.json"
	[ "$status" -eq 0 ]
	expect_event_name PostToolUse
	local ctx
	ctx="$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext)' <<< "$output")"
	[[ "$ctx" == *"Changeset validation found issues"* ]]
	[[ "$ctx" == *"CSH001"* ]]
	done
}

@test "changeset file, validation PASSES: no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_stub_savvy 0 0 ""
	silk_run "$HOOK" "${FIXTURES_DIR}/posttooluse.changeset-file.json"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
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

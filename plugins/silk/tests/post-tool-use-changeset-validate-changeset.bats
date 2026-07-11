#!/usr/bin/env bats
# tests/post-tool-use-changeset-validate-changeset.bats
#
# Coverage for hooks/post-tool-use/changeset-validate-changeset.sh: after a
# Write|Edit, if the file is a changeset (.changeset/<name>.md, excluding
# README.md), run `savvy changeset validate-file` and surface any findings as
# additionalContext. Never blocks.
#
# The CLI-touching paths pin the runner to npm and stub `npx` so the real
# savvy CLI installed in this workspace is never invoked (that non-determinism
# is exactly what the hermetic env in test_helper.bash guards against).

load 'test_helper'

HOOK="${HOOKS_DIR}/post-tool-use/changeset-validate-changeset.sh"

setup() {
	common_setup
	make_project >/dev/null
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
	_stub_savvy 0 1 "should not run"
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.write-non-changeset.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test ".changeset/README.md: no-op (README is not a changeset)" {
	_stub_savvy 0 1 "should not run"
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.changeset-readme.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "missing file_path: no-op" {
	_stub_savvy 0 1 "should not run"
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.write-empty.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "changeset file, CLI unavailable (--version fails): silent no-op" {
	_stub_savvy 1 1 "unreachable"
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.changeset-file.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "changeset file, validation FAILS: emits findings as additionalContext" {
	_stub_savvy 0 1 "CSH001: section heading missing at line 3"
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.changeset-file.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "PostToolUse" ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"Changeset validation found issues"* ]]
	[[ "$ctx" == *"CSH001"* ]]
}

@test "changeset file, validation PASSES: no-op" {
	_stub_savvy 0 0 ""
	run bash -c "cat '${FIXTURES_DIR}/posttooluse.changeset-file.json' | '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "malformed JSON input: non-zero exit (jq parse error)" {
	run bash -c "printf 'not json' | '${HOOK}' 2>/dev/null"
	[ "$status" -ne 0 ]
	[ -z "$output" ]
}

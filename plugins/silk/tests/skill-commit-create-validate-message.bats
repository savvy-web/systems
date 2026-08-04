#!/usr/bin/env bats
# tests/skill-commit-create-validate-message.bats
#
# Coverage for skills/commit-create/scripts/validate-message.sh. Unlike the
# hooks/** suites, this script is not a hook (no JSON envelope in, no JSON
# decision out) — it is a plain CLI script the commit-create skill mandates
# running before `git commit`. Its pass/fail authority is the REAL
# commitlint preset invoked via the project's package-manager runner, so —
# matching the "stub the CLI, never invoke the real toolchain in tests"
# convention this suite already uses for the savvy CLI shell-outs — every
# test here stubs `npx` to stand in for commitlint rather than requiring a
# real pnpm install. This also keeps the suite compatible with
# .github/workflows/hook-tests.yml, which runs bats/shellcheck/jq only and
# deliberately does not install Node.js/pnpm.

load 'test_helper'

SCRIPT="${PLUGIN_ROOT}/skills/commit-create/scripts/validate-message.sh"

setup() {
	common_setup
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	# The script hard-requires this config file to exist before it will even
	# attempt to resolve a runner; the real value never matters to the stub.
	mkdir -p "${CLAUDE_PROJECT_DIR}/lib/configs"
	: >"${CLAUDE_PROJECT_DIR}/lib/configs/commitlint.config.ts"
}

_stub_commitlint() {
	local exit_code="$1"
	write_stub npx <<STUB
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
exit ${exit_code}
STUB
}

_write_msg() {
	local dest="${BATS_TEST_TMPDIR}/msg.txt"
	printf '%s' "$1" >"$dest"
	echo "$dest"
}

@test "usage error when no file argument given" {
	run bash "$SCRIPT"
	[ "$status" -eq 1 ]
	[[ "$output" == *"Usage:"* ]]
}

@test "missing file: error" {
	run bash "$SCRIPT" "${BATS_TEST_TMPDIR}/does-not-exist.txt"
	[ "$status" -eq 1 ]
	[[ "$output" == *"message file not found"* ]]
}

@test "empty file: error" {
	local msg="${BATS_TEST_TMPDIR}/empty.txt"
	: >"$msg"
	run bash "$SCRIPT" "$msg"
	[ "$status" -eq 1 ]
	[[ "$output" == *"message file is empty"* ]]
}

@test "valid message, commitlint accepts: exit 0 with PASS" {
	_stub_commitlint 0
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	run bash "$SCRIPT" "$msg"
	[ "$status" -eq 0 ]
	[[ "$output" == *"PASS: commit message satisfies the @savvy-web/commitlint preset."* ]]
	[[ "$output" != *"MEASURED VIOLATION"* ]]
}

@test "commitlint rejects: exit 1 with FAIL" {
	_stub_commitlint 1
	local msg
	msg=$(_write_msg $'chore: bump lockfile\n\nSigned-off-by: Silk Test <test@example.com>\n')
	run bash "$SCRIPT" "$msg"
	[ "$status" -eq 1 ]
	[[ "$output" == *"FAIL: commitlint rejected this message"* ]]
}

@test "body line over 300 chars: measured violation with exact line number and length" {
	_stub_commitlint 1
	local long_line
	long_line=$(printf 'x%.0s' $(seq 1 320))
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\n'"${long_line}"$'\n\nSigned-off-by: Silk Test <test@example.com>\n')
	run bash "$SCRIPT" "$msg"
	[[ "$output" == *"MEASURED VIOLATION: body line 3 is 320 chars (limit 300)"* ]]
}

@test "header over 100 chars: measured violation on line 1" {
	_stub_commitlint 1
	local long_subject
	long_subject="feat(auth): $(printf 'x%.0s' $(seq 1 95))"
	local msg
	msg=$(_write_msg "${long_subject}"$'\n\nSigned-off-by: Silk Test <test@example.com>\n')
	local len=${#long_subject}
	run bash "$SCRIPT" "$msg"
	[[ "$output" == *"MEASURED VIOLATION: header line 1 is ${len} chars (limit 100)"* ]]
}

@test "footer (Signed-off-by) line over 100 chars: measured violation, not misclassified as body" {
	_stub_commitlint 1
	local long_signoff
	long_signoff="Signed-off-by: $(printf 'x%.0s' $(seq 1 95)) <test@example.com>"
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\n'"${long_signoff}"$'\n')
	local len=${#long_signoff}
	run bash "$SCRIPT" "$msg"
	[[ "$output" == *"MEASURED VIOLATION: footer line 3 is ${len} chars (limit 100)"* ]]
}

@test "Closes trailer line counted as footer, not body" {
	_stub_commitlint 0
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\nExplains the fix in one short line.\n\nCloses #42\nSigned-off-by: Silk Test <test@example.com>\n')
	run bash "$SCRIPT" "$msg"
	[[ "$output" == *"Footer: longest line"* ]]
	[[ "$output" != *"MEASURED VIOLATION"* ]]
}

# The house format separates the Closes line from the signoff with a blank
# line. If the backward footer scan stopped at that blank, only the signoff
# would count as footer and an over-long Closes line would be measured against
# the body's 300 cap — silent here, then rejected by the commit-msg hook. That
# is the exact failure this script exists to prevent, so it gets its own case.
#
# The adjacent-lines test above passes either way; only the blank line
# discriminates.
@test "over-long Closes line separated from signoff by a blank line: measured as footer, not body" {
	_stub_commitlint 1
	local long_closes
	# Must exceed FOOTER_MAX=100 to trip the violation — a shorter list is
	# classified as footer correctly but reports nothing, proving nothing.
	long_closes="Closes #101, #102, #103, #104, #105, #106, #107, #108, #109, #110, #111, #112, #113, #114, #115, #116, #117, #118"
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\nExplains the fix in one short line.\n\n'"${long_closes}"$'\n\nSigned-off-by: Silk Test <test@example.com>\n')
	local len=${#long_closes}
	run bash "$SCRIPT" "$msg"
	[[ "$output" == *"MEASURED VIOLATION: footer line 5 is ${len} chars (limit 100)"* ]]
	[[ "$output" != *"MEASURED VIOLATION: body"* ]]
}

@test "blank line between trailers does not swallow the body into the footer" {
	# The scan may only cross a blank that sits BETWEEN two trailers. The blank
	# separating the body from the footer must still end it, or a long body
	# line would be measured against the footer's 100 cap instead of 300.
	_stub_commitlint 0
	local long_body
	long_body="- $(printf 'x%.0s' $(seq 1 150))"
	local msg
	msg=$(_write_msg $'fix(cli): resolve a crash\n\n'"${long_body}"$'\n\nCloses #42\n\nSigned-off-by: Silk Test <test@example.com>\n')
	run bash "$SCRIPT" "$msg"
	[[ "$output" == *"Body: longest line ${#long_body}/300"* ]]
	[[ "$output" != *"MEASURED VIOLATION"* ]]
}

@test "single-line message (no body, no footer) does not crash the measurement pass" {
	_stub_commitlint 1
	local msg
	msg=$(_write_msg 'chore: bump lockfile')
	run bash "$SCRIPT" "$msg"
	[[ "$output" == *"Body: no body lines."* ]]
	[[ "$output" == *"Footer: no trailer lines detected."* ]]
}

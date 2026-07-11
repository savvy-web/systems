#!/usr/bin/env bats
# tests/session-start-startup-only.bats
#
# Coverage for hooks/session-start/startup-only.sh (matcher: startup): run the
# `savvy commit hook session-start` side-effect (stdout discarded) and emit the
# Silk-system intro + code-quality orientation. If CLAUDE_PROJECT_DIR is unset
# it emits a no-op (a SessionStart cannot block). This hook does NOT parse
# stdin — it drains it — so its behaviour is independent of the envelope body.
#
# The context-emitting path pins the runner to npm and stubs `npx` so the real
# savvy CLI is never invoked.

load 'test_helper'

HOOK="${HOOKS_DIR}/session-start/startup-only.sh"

setup() {
	common_setup
}

@test "CLAUDE_PROJECT_DIR unset: no-op (cannot block a SessionStart)" {
	# common_setup already unset CLAUDE_PROJECT_DIR.
	run bash -c "cat '${FIXTURES_DIR}/sessionstart.startup.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "with a project dir: emits the code-quality orientation context" {
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
	run bash -c "cat '${FIXTURES_DIR}/sessionstart.startup.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
	local ctx
	ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<< "$output")"
	[[ "$ctx" == *"silk_system"* ]]
	[[ "$ctx" == *"useImportExtensions"* ]]
}

@test "side-effect CLI failure does not block: context still emitted" {
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
echo 'session-start side effect exploded' >&2
exit 1
STUB
	run bash -c "cat '${FIXTURES_DIR}/sessionstart.startup.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
}

@test "stdin is drained, not parsed: malformed body with a project dir still emits context" {
	make_project >/dev/null
	force_npm_runner
	use_stub_bin
	write_stub npx <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
	run bash -c "printf 'not json at all' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.hookSpecificOutput.hookEventName' <<< "$output")" = "SessionStart" ]
}

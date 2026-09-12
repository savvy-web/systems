#!/usr/bin/env bats
# tests/bin-start-mcp.bats
#
# Coverage for bin/start-mcp.sh, the plugin's MCP server loader. Unlike the
# hooks/** suites, this script is not a hook (no JSON envelope in, no JSON
# decision out) — plugin.json launches it as `sh bin/start-mcp.sh` and it
# execs the savvy-mcp server. Every test invokes it the same way (`sh`, not
# `bash`) so the suite exercises the POSIX contract the manifest relies on.
#
# The exec target is always the project's OWN node_modules/.bin/savvy-mcp
# when present, otherwise `npx --yes @savvy-web/mcp` — never a package-manager
# dispatch. Package-manager detection only picks the install line printed to
# stderr. Matching the "stub the CLI, never invoke the real toolchain" rule
# this suite uses everywhere, the fake bin and `npx` are stubs that print
# their argv and the env the server reads.

# `run --separate-stderr` (used to assert the hint never reaches stdout, the
# MCP transport channel) needs bats-core >= 1.5.0.
bats_require_minimum_version 1.5.0

load 'test_helper'

SCRIPT="${PLUGIN_ROOT}/bin/start-mcp.sh"

setup() {
	common_setup
	make_project >/dev/null
	use_stub_bin
	# Launch from a neutral cwd so a `$(pwd)` fallback could never resolve to
	# this real checkout (which has its own package.json / pnpm-lock.yaml).
	cd "$BATS_TEST_TMPDIR"
}

# _install_fake_bin — put an executable savvy-mcp into the project's
# node_modules/.bin that reports how it was invoked.
_install_fake_bin() {
	mkdir -p "${CLAUDE_PROJECT_DIR}/node_modules/.bin"
	cat >"${CLAUDE_PROJECT_DIR}/node_modules/.bin/savvy-mcp" <<'FAKE'
#!/usr/bin/env bash
echo "FAKE_BIN argv=[$*]"
echo "FAKE_BIN SAVVY_MCP_PROJECT_DIR=${SAVVY_MCP_PROJECT_DIR:-<unset>}"
echo "FAKE_BIN CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR:-<unset>}"
FAKE
	chmod +x "${CLAUDE_PROJECT_DIR}/node_modules/.bin/savvy-mcp"
}

# _stub_npx — a PATH stub standing in for the real npx fallback.
_stub_npx() {
	write_stub npx <<'STUB'
#!/usr/bin/env bash
echo "STUB_NPX argv=[$*]"
echo "STUB_NPX SAVVY_MCP_PROJECT_DIR=${SAVVY_MCP_PROJECT_DIR:-<unset>}"
exit 0
STUB
}

# _stub_pm_dispatchers — every package-manager dispatch the old loader used.
# Each one fails loudly so a regression back to `pnpm exec` etc. is caught.
_stub_pm_dispatchers() {
	local name
	for name in pnpm yarn bun bunx; do
		write_stub "$name" <<'STUB'
#!/usr/bin/env bash
echo "PM_DISPATCH $0 $*"
exit 99
STUB
	done
}

# --- exec path: project-local bin -------------------------------------------

@test "executable node_modules/.bin/savvy-mcp: exec'd with argv and both project-dir env vars" {
	_install_fake_bin
	_stub_npx
	run sh "$SCRIPT" --flag value
	[ "$status" -eq 0 ]
	[[ "$output" == *"FAKE_BIN argv=[--flag value]"* ]]
	[[ "$output" == *"FAKE_BIN SAVVY_MCP_PROJECT_DIR=${CLAUDE_PROJECT_DIR}"* ]]
	[[ "$output" == *"FAKE_BIN CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR}"* ]]
	[[ "$output" != *"STUB_NPX"* ]]
	[[ "$output" != *"not installed"* ]]
}

@test "project-local bin wins even when a package manager is detectable" {
	_install_fake_bin
	_stub_npx
	_stub_pm_dispatchers
	printf '{"packageManager":"pnpm@11.22.0"}\n' >"${CLAUDE_PROJECT_DIR}/package.json"
	: >"${CLAUDE_PROJECT_DIR}/pnpm-lock.yaml"
	run sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"FAKE_BIN argv=[]"* ]]
	[[ "$output" != *"PM_DISPATCH"* ]]
	[[ "$output" != *"STUB_NPX"* ]]
}

@test "non-executable node_modules/.bin/savvy-mcp: falls through to npx" {
	_install_fake_bin
	chmod -x "${CLAUDE_PROJECT_DIR}/node_modules/.bin/savvy-mcp"
	_stub_npx
	run sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"STUB_NPX argv=[--yes @savvy-web/mcp]"* ]]
	[[ "$output" != *"FAKE_BIN"* ]]
}

@test "no CLAUDE_PROJECT_DIR: ROOT falls back to cwd" {
	_install_fake_bin
	_stub_npx
	local proj="$CLAUDE_PROJECT_DIR"
	unset CLAUDE_PROJECT_DIR
	cd "$proj"
	run sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"FAKE_BIN SAVVY_MCP_PROJECT_DIR=${proj}"* ]]
	[[ "$output" == *"FAKE_BIN CLAUDE_PROJECT_DIR=${proj}"* ]]
}

# --- fallback path: npx + install hint --------------------------------------

@test "not installed: execs npx --yes @savvy-web/mcp with argv and the env vars set" {
	_stub_npx
	_stub_pm_dispatchers
	run sh "$SCRIPT" --a --b
	[ "$status" -eq 0 ]
	[[ "$output" == *"STUB_NPX argv=[--yes @savvy-web/mcp --a --b]"* ]]
	[[ "$output" == *"STUB_NPX SAVVY_MCP_PROJECT_DIR=${CLAUDE_PROJECT_DIR}"* ]]
	[[ "$output" != *"PM_DISPATCH"* ]]
}

@test "not installed: hint goes to stderr, stdout stays clean for the MCP transport" {
	_stub_npx
	run --separate-stderr sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"silk plugin: savvy-mcp is not installed in this project."* ]]
	[[ "$stderr" == *"Project directory: ${CLAUDE_PROJECT_DIR}"* ]]
	[[ "$stderr" == *"Falling back to npx --yes @savvy-web/mcp"* ]]
	[[ "$output" == "STUB_NPX argv=[--yes @savvy-web/mcp]"* ]]
	[[ "$output" != *"not installed"* ]]
}

@test "detect: empty project defaults to npm" {
	_stub_npx
	run --separate-stderr sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"Detected package manager: npm"* ]]
	[[ "$stderr" == *"  npm install --save-dev @savvy-web/silk"* ]]
}

@test "detect: pnpm-lock.yaml -> pnpm add -D" {
	_stub_npx
	: >"${CLAUDE_PROJECT_DIR}/pnpm-lock.yaml"
	run --separate-stderr sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"Detected package manager: pnpm"* ]]
	[[ "$stderr" == *"  pnpm add -D @savvy-web/silk"* ]]
}

@test "detect: bun.lock -> bun add -d" {
	_stub_npx
	: >"${CLAUDE_PROJECT_DIR}/bun.lock"
	run --separate-stderr sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"Detected package manager: bun"* ]]
	[[ "$stderr" == *"  bun add -d @savvy-web/silk"* ]]
}

@test "detect: bun.lockb -> bun add -d" {
	_stub_npx
	: >"${CLAUDE_PROJECT_DIR}/bun.lockb"
	run --separate-stderr sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"Detected package manager: bun"* ]]
}

@test "detect: yarn.lock -> yarn add -D" {
	_stub_npx
	: >"${CLAUDE_PROJECT_DIR}/yarn.lock"
	run --separate-stderr sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"Detected package manager: yarn"* ]]
	[[ "$stderr" == *"  yarn add -D @savvy-web/silk"* ]]
}

@test "detect: package-lock.json -> npm install --save-dev" {
	_stub_npx
	: >"${CLAUDE_PROJECT_DIR}/package-lock.json"
	run --separate-stderr sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"Detected package manager: npm"* ]]
	[[ "$stderr" == *"  npm install --save-dev @savvy-web/silk"* ]]
}

@test "detect: lockfile precedence is pnpm > bun > yarn > npm when several co-exist" {
	_stub_npx
	: >"${CLAUDE_PROJECT_DIR}/yarn.lock"
	: >"${CLAUDE_PROJECT_DIR}/bun.lock"
	: >"${CLAUDE_PROJECT_DIR}/package-lock.json"
	run --separate-stderr sh "$SCRIPT"
	[[ "$stderr" == *"Detected package manager: bun"* ]]
	: >"${CLAUDE_PROJECT_DIR}/pnpm-lock.yaml"
	run --separate-stderr sh "$SCRIPT"
	[[ "$stderr" == *"Detected package manager: pnpm"* ]]
}

@test "detect: packageManager field wins over a co-present lockfile" {
	_stub_npx
	printf '{\n\t"name": "x",\n\t"packageManager": "yarn@4.5.0"\n}\n' >"${CLAUDE_PROJECT_DIR}/package.json"
	: >"${CLAUDE_PROJECT_DIR}/pnpm-lock.yaml"
	run --separate-stderr sh "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"Detected package manager: yarn"* ]]
	[[ "$stderr" == *"  yarn add -D @savvy-web/silk"* ]]
}

@test "detect: packageManager field with a +sha suffix still parses" {
	_stub_npx
	printf '{"packageManager":"bun@1.2.0+sha512.abcdef"}\n' >"${CLAUDE_PROJECT_DIR}/package.json"
	run --separate-stderr sh "$SCRIPT"
	[[ "$stderr" == *"Detected package manager: bun"* ]]
}

@test "detect: unknown packageManager value falls back to lockfile detection" {
	_stub_npx
	printf '{"packageManager":"deno@2.0.0"}\n' >"${CLAUDE_PROJECT_DIR}/package.json"
	: >"${CLAUDE_PROJECT_DIR}/yarn.lock"
	run --separate-stderr sh "$SCRIPT"
	[[ "$stderr" == *"Detected package manager: yarn"* ]]
}

@test "detect: package.json without packageManager falls back to lockfile detection" {
	_stub_npx
	printf '{"name":"x"}\n' >"${CLAUDE_PROJECT_DIR}/package.json"
	: >"${CLAUDE_PROJECT_DIR}/pnpm-lock.yaml"
	run --separate-stderr sh "$SCRIPT"
	[[ "$stderr" == *"Detected package manager: pnpm"* ]]
}

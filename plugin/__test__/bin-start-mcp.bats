#!/usr/bin/env bats
# __test__/bin-start-mcp.bats
#
# Coverage for bin/start-mcp.sh, the savvy-mcp launcher, written on
# pluginfinity's server library. It is not a hook: the manifest launches it as
# `sh bin/start-mcp.sh` with PLUGINFINITY_HOST / PLUGINFINITY_PLUGIN /
# PLUGINFINITY_LIB in its env, and it execs the savvy-mcp server. Every test
# runs the BUILT launcher under env -i with exactly that environment.
#
# The exec target is the project's OWN node_modules/.bin/savvy-mcp when
# present. Otherwise the library's server_exec_bin falls back through the
# project's package manager (pluginfinity 0.3.0, upstream commits d970652 and
# a4d5860): `pnpm dlx` / `yarn dlx` / `bunx` when that runner is on PATH, else
# `npx --yes @savvy-web/mcp`. A bare `npx` in a devEngines pnpm project fails
# with EBADDEVENGINES under npm 11, which is why it changed. Package-manager
# detection also picks the install line printed to stderr. The fake bin, `npx`
# and the dispatchers are stubs that print their argv and the env the server
# reads.

load common

silk_file_setup() {
	use_stub_bin
	PROJ="${SILK_TMP}/project"
	mkdir -p "$PROJ/.git"
	# Hermetic dispatchers: since pluginfinity 0.3.0 the fallback execs
	# `pnpm dlx` / `yarn dlx` / `bunx` when that runner is on PATH. Without these
	# stubs a lockfile test reaches the developer's real package manager, which
	# downloads and STARTS the real savvy-mcp server (it then blocks on stdin).
	local name
	for name in pnpm yarn bun bunx; do
		write_stub "$name" <<'STUB'
#!/usr/bin/env bash
echo "STUB_DISPATCH $(basename "$0") argv=[$*]"
STUB
	done
}

# _launch [args...] — run the built launcher the way the host does. Claude Code
# starts it in the project with CLAUDE_PROJECT_DIR set; Copilot starts an MCP
# server at the plugin root and gives it no project directory.
_launch() {
	local root="$PLUGIN_DIR/builds/$SILK_TARGET"
	local -a env=(PATH="$PATH" HOME="$HOME" XDG_STATE_HOME="$XDG_STATE_HOME"
		PLUGINFINITY_HOST="$SILK_TARGET" PLUGINFINITY_PLUGIN=silk PLUGINFINITY_LIB="$root/lib/pluginfinity")
	if [ "$SILK_TARGET" = claude ]; then
		run --separate-stderr env -i "${env[@]}" CLAUDE_PROJECT_DIR="${LAUNCH_PROJECT_DIR-$PROJ}" \
			sh -c 'cd "$1" && shift && exec sh "$@"' _ "${LAUNCH_CWD:-$PROJ}" "$root/bin/start-mcp.sh" "$@"
	else
		run --separate-stderr env -i "${env[@]}" \
			sh -c 'cd "$1" && shift && exec sh "$@"' _ "${LAUNCH_CWD:-$root}" "$root/bin/start-mcp.sh" "$@"
	fi
}

# _install_fake_bin — an executable savvy-mcp in the project's node_modules/.bin.
_install_fake_bin() {
	mkdir -p "${PROJ}/node_modules/.bin"
	cat >"${PROJ}/node_modules/.bin/savvy-mcp" <<'FAKE'
#!/usr/bin/env bash
echo "FAKE_BIN argv=[$*]"
echo "FAKE_BIN SAVVY_MCP_PROJECT_DIR=${SAVVY_MCP_PROJECT_DIR:-<unset>}"
echo "FAKE_BIN CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR:-<unset>}"
FAKE
	chmod +x "${PROJ}/node_modules/.bin/savvy-mcp"
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

# --- Claude Code: exec path -------------------------------------------------

@test "claude: executable node_modules/.bin/savvy-mcp is exec'd with argv and both project-dir env vars" {
	silk_setup claude
	_install_fake_bin
	_stub_npx
	_launch --flag value
	[ "$status" -eq 0 ]
	[ "$output" = "FAKE_BIN argv=[--flag value]
FAKE_BIN SAVVY_MCP_PROJECT_DIR=${PROJ}
FAKE_BIN CLAUDE_PROJECT_DIR=${PROJ}" ]
}

@test "claude: project-local bin wins even when a package manager is detectable" {
	silk_setup claude
	_install_fake_bin
	_stub_npx
	_stub_pm_dispatchers
	printf '{"packageManager":"pnpm@11.22.0"}\n' >"${PROJ}/package.json"
	: >"${PROJ}/pnpm-lock.yaml"
	_launch
	[ "$status" -eq 0 ]
	[[ "$output" == *"FAKE_BIN argv=[]"* ]]
	[[ "$output" != *"PM_DISPATCH"* ]]
	[[ "$output" != *"STUB_NPX"* ]]
}

@test "claude: non-executable node_modules/.bin/savvy-mcp falls through to npx" {
	silk_setup claude
	_install_fake_bin
	chmod -x "${PROJ}/node_modules/.bin/savvy-mcp"
	_stub_npx
	_launch
	[ "$status" -eq 0 ]
	[[ "$output" == *"STUB_NPX argv=[--yes @savvy-web/mcp]"* ]]
	[[ "$output" != *"FAKE_BIN"* ]]
}

@test "claude: no CLAUDE_PROJECT_DIR — the project is found from the cwd's git root" {
	silk_setup claude
	_install_fake_bin
	_stub_npx
	mkdir -p "$PROJ/sub/dir"
	LAUNCH_PROJECT_DIR="" LAUNCH_CWD="$PROJ/sub/dir" _launch
	[ "$status" -eq 0 ]
	[[ "$output" == *"FAKE_BIN SAVVY_MCP_PROJECT_DIR=${PROJ}"* ]]
	[[ "$output" == *"FAKE_BIN CLAUDE_PROJECT_DIR=${PROJ}"* ]]
}

# --- Claude Code: fallback path ---------------------------------------------

@test "claude: not installed — execs npx --yes @savvy-web/mcp with argv and the env vars set" {
	silk_setup claude
	_stub_npx
	_stub_pm_dispatchers
	_launch --a --b
	[ "$status" -eq 0 ]
	[[ "$output" == *"STUB_NPX argv=[--yes @savvy-web/mcp --a --b]"* ]]
	[[ "$output" == *"STUB_NPX SAVVY_MCP_PROJECT_DIR=${PROJ}"* ]]
	[[ "$output" != *"PM_DISPATCH"* ]]
}

@test "claude: not installed — hint goes to stderr, stdout stays clean for the MCP transport" {
	silk_setup claude
	_stub_npx
	_launch
	[ "$status" -eq 0 ]
	[[ "$stderr" == *"silk: savvy-mcp is not installed in ${PROJ}."* ]]
	[[ "$stderr" == *"  npm install --save-dev @savvy-web/silk"* ]]
	[[ "$stderr" == *'Falling back to "npx --yes @savvy-web/mcp"'* ]]
	[ "$output" = "STUB_NPX argv=[--yes @savvy-web/mcp]
STUB_NPX SAVVY_MCP_PROJECT_DIR=${PROJ}" ]
}

@test "claude: install hint follows the project's package manager" {
	silk_setup claude
	_stub_npx
	: >"${PROJ}/pnpm-lock.yaml"
	_launch
	[[ "$stderr" == *"  pnpm add -D @savvy-web/silk"* ]]
	rm "${PROJ}/pnpm-lock.yaml"
	: >"${PROJ}/bun.lockb"
	_launch
	[[ "$stderr" == *"  bun add -d @savvy-web/silk"* ]]
	rm "${PROJ}/bun.lockb"
	: >"${PROJ}/yarn.lock"
	_launch
	[[ "$stderr" == *"  yarn add -D @savvy-web/silk"* ]]
	printf '{"packageManager":"bun@1.2.0+sha512.abcdef"}\n' >"${PROJ}/package.json"
	_launch
	[[ "$stderr" == *"  bun add -d @savvy-web/silk"* ]]
	# A declared manager the library does not know falls through to the lockfile,
	# as plugins/silk did (yarn.lock is still here)...
	printf '{"packageManager":"deno@2.0.0"}\n' >"${PROJ}/package.json"
	_launch
	[[ "$stderr" == *"  yarn add -D @savvy-web/silk"* ]]
	# ...and to npm only when there is no lockfile either.
	rm "${PROJ}/yarn.lock"
	_launch
	[[ "$stderr" == *"  npm install --save-dev @savvy-web/silk"* ]]
}

@test "claude: not installed, pnpm project with pnpm on PATH — falls back through pnpm dlx" {
	silk_setup claude
	_stub_npx
	write_stub pnpm <<'STUB'
#!/usr/bin/env bash
echo "STUB_PNPM argv=[$*]"
STUB
	printf '{"devEngines":{"packageManager":{"name":"pnpm","version":"12.10.0"}}}\n' >"${PROJ}/package.json"
	_launch --a
	[ "$status" -eq 0 ]
	[ "$output" = "STUB_PNPM argv=[dlx @savvy-web/mcp --a]" ]
	[[ "$stderr" == *"  pnpm add -D @savvy-web/silk"* ]]
	[[ "$stderr" == *'Falling back to "pnpm dlx @savvy-web/mcp"'* ]]
}

# --- Copilot ----------------------------------------------------------------

@test "copilot: started at the plugin root with no project — straight to npx, nothing exported" {
	silk_setup copilot
	_install_fake_bin
	_stub_npx
	_launch --a
	[ "$status" -eq 0 ]
	[ "$output" = "STUB_NPX argv=[--yes @savvy-web/mcp --a]
STUB_NPX SAVVY_MCP_PROJECT_DIR=<unset>" ]
	[[ "$stderr" == *"no project directory is known"* ]]
}

@test "copilot: started inside a project (not the plugin root) — the project-local bin wins" {
	silk_setup copilot
	_install_fake_bin
	_stub_npx
	LAUNCH_CWD="$PROJ" _launch
	[ "$status" -eq 0 ]
	[[ "$output" == *"FAKE_BIN SAVVY_MCP_PROJECT_DIR=${PROJ}"* ]]
}

# --- biome-lsp.sh -----------------------------------------------------------

@test "biome-lsp: global biome on PATH wins, on both targets" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	write_stub biome <<'STUB'
#!/usr/bin/env bash
echo "GLOBAL_BIOME $*"
STUB
	local root="$PLUGIN_DIR/builds/$SILK_TARGET"
	run --separate-stderr env -i PATH="$PATH" HOME="$HOME" PLUGINFINITY_HOST="$SILK_TARGET" \
		PLUGINFINITY_PLUGIN=silk PLUGINFINITY_LIB="$root/lib/pluginfinity" \
		sh -c 'cd "$1" && shift && exec sh "$@"' _ "$PROJ" "$root/bin/biome-lsp.sh"
	[ "$status" -eq 0 ]
	[ "$output" = "GLOBAL_BIOME lsp-proxy" ]
	done
}

@test "biome-lsp: project-local biome found from the project (Claude) or the git root cwd (Copilot)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	mkdir -p "$PROJ/node_modules/.bin"
	printf '#!/usr/bin/env bash\necho "LOCAL_BIOME $*"\n' >"$PROJ/node_modules/.bin/biome"
	chmod +x "$PROJ/node_modules/.bin/biome"
	local root="$PLUGIN_DIR/builds/$SILK_TARGET"
	local -a extra=()
	[ "$SILK_TARGET" = claude ] && extra=(CLAUDE_PROJECT_DIR="$PROJ")
	# A PATH without any global biome: the system dirs plus nothing else.
	run --separate-stderr env -i PATH="/usr/bin:/bin" HOME="$HOME" PLUGINFINITY_HOST="$SILK_TARGET" \
		PLUGINFINITY_PLUGIN=silk PLUGINFINITY_LIB="$root/lib/pluginfinity" "${extra[@]}" \
		sh -c 'cd "$1" && shift && exec sh "$@"' _ "$PROJ" "$root/bin/biome-lsp.sh"
	[ "$status" -eq 0 ]
	[ "$output" = "LOCAL_BIOME lsp-proxy" ]
	done
}

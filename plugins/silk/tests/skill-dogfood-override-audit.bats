#!/usr/bin/env bats
# tests/skill-dogfood-override-audit.bats
#
# Coverage for skills/dogfood/scripts/override-audit.mjs (savvy-web/systems#519,
# deferred from #425): warn when a file:/link: override's target would have
# resolved fine from the registry, stay quiet when the override is doing real
# work, skip commented-out entries, ignore non-registry range specifiers, and
# never exit nonzero for a warning (warn-only contract).

load 'test_helper'

SCRIPT="${PLUGIN_ROOT}/skills/dogfood/scripts/override-audit.mjs"

setup() {
	common_setup
	use_stub_bin
	WORKSPACE="${BATS_TEST_TMPDIR}/workspace"
	mkdir -p "$WORKSPACE"
	NPM_CALL_LOG="${BATS_TEST_TMPDIR}/npm-calls.log"
	export NPM_CALL_LOG
	# The stub answers `npm view <pkg>@<range> version --json` with the contents
	# of NPM_VIEW_OUTPUT when set (a satisfying registry version), else with
	# nothing (no published version satisfies). Every call is logged so tests
	# can assert the registry was, or was not, consulted.
	write_stub npm <<-'EOF'
		#!/usr/bin/env bash
		printf '%s\n' "$*" >> "$NPM_CALL_LOG"
		if [ -n "${NPM_VIEW_OUTPUT:-}" ]; then
			printf '%s\n' "$NPM_VIEW_OUTPUT"
		fi
	EOF
}

# make_workspace <override-value> <declared-range> — a minimal downstream tree:
# one overrides: entry for @effected/glob, one consumer manifest declaring it,
# and a built artifact at the link path.
make_workspace() {
	local override_value="$1" declared_range="$2"
	cat > "${WORKSPACE}/pnpm-workspace.yaml" <<-EOF
		packages:
		  - packages/*
		overrides:
		  "@effected/glob": "${override_value}"
	EOF
	mkdir -p "${WORKSPACE}/packages/consumer"
	cat > "${WORKSPACE}/packages/consumer/package.json" <<-EOF
		{"name":"consumer","dependencies":{"@effected/glob":"${declared_range}"}}
	EOF
	mkdir -p "${WORKSPACE}/artifact/pkg"
	printf '{"name":"@effected/glob","version":"0.2.0"}\n' > "${WORKSPACE}/artifact/pkg/package.json"
}

@test "warns when the registry already satisfies the declared range" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	export NPM_VIEW_OUTPUT='"0.2.1"'
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"WARNING"* ]]
	[[ "$output" == *"@effected/glob"* ]]
	[[ "$output" == *"0.2.1"* ]]
	[[ "$output" == *"0.2.0"* ]]
	[[ "$output" == *"1 warning(s)"* ]]
	grep -q '@effected/glob@\^0.2.0' "$NPM_CALL_LOG"
}

@test "stays quiet when no published version satisfies the range" {
	make_workspace "file:./artifact/pkg" "^0.3.0"
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" != *"WARNING"* ]]
	[[ "$output" == *"0 warning(s)"* ]]
}

@test "reports nothing to audit when the overrides block has no local entries" {
	cat > "${WORKSPACE}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - packages/*
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"nothing to audit"* ]]
}

@test "skips commented-out override entries" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	cat > "${WORKSPACE}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - packages/*
		overrides:
		  # "@effected/glob": "file:./artifact/pkg"
	EOF
	export NPM_VIEW_OUTPUT='"0.2.1"'
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"nothing to audit"* ]]
}

@test "ignores workspace:/catalog: specifiers and never asks the registry about them" {
	make_workspace "file:./artifact/pkg" "workspace:*"
	cat > "${WORKSPACE}/packages/consumer/package.json" <<-'EOF'
		{"name":"consumer","dependencies":{"@effected/glob":"catalog:effect"}}
	EOF
	export NPM_VIEW_OUTPUT='"0.2.1"'
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"0 warning(s)"* ]]
	[ ! -f "$NPM_CALL_LOG" ] || ! grep -q '@effected/glob' "$NPM_CALL_LOG"
}

@test "reports an unverified probe when npm itself fails, never a clean audit" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	write_stub npm <<-'EOF'
		#!/usr/bin/env bash
		echo "npm ERR! network request failed" >&2
		exit 1
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"UNVERIFIED"* ]]
	[[ "$output" == *"0 warning(s)"* ]]
	[[ "$output" == *"1 unverified probe(s)"* ]]
}

@test "treats an npm E404 as definitively absent, not as an unverified probe" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	write_stub npm <<-'EOF'
		#!/usr/bin/env bash
		echo "npm ERR! code E404" >&2
		exit 1
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"0 warning(s)"* ]]
	[[ "$output" == *"0 unverified probe(s)"* ]]
}

@test "does not warn while any declared range still needs the linked build" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	mkdir -p "${WORKSPACE}/packages/other"
	cat > "${WORKSPACE}/packages/other/package.json" <<-'EOF'
		{"name":"other","dependencies":{"@effected/glob":"^0.3.0"}}
	EOF
	write_stub npm <<-'EOF'
		#!/usr/bin/env bash
		printf '%s\n' "$*" >> "$NPM_CALL_LOG"
		case "$*" in
			*"@^0.2.0"*) printf '"0.2.1"\n' ;;
		esac
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" != *"WARNING"* ]]
	[[ "$output" == *"0 warning(s)"* ]]
	grep -q '@effected/glob@\^0.3.0' "$NPM_CALL_LOG"
}

@test "warns when the link path has no readable manifest" {
	make_workspace "file:./missing/pkg" "^0.3.0"
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"no manifest is readable"* ]]
	[[ "$output" == *"1 warning(s)"* ]]
}

@test "exits 2 when the workspace yaml does not exist" {
	run node "$SCRIPT" "${WORKSPACE}/nope.yaml"
	[ "$status" -eq 2 ]
}

@test "names EBADDEVENGINES as the cause of an unverified probe" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	write_stub npm <<-'EOF'
		#!/usr/bin/env bash
		echo 'npm error code EBADDEVENGINES' >&2
		exit 1
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"UNVERIFIED"* ]]
	[[ "$output" == *"EBADDEVENGINES"* ]]
	[[ "$output" != *"network or registry error"* ]]
	[[ "$output" == *"1 unverified probe(s)"* ]]
}

# fail_all_stubs — every package manager binary fails with a generic error, so
# the UNVERIFIED line (which names the detected manager and its source) is the
# observable for detection tests.
fail_all_stubs() {
	local name
	for name in npm pnpm bun yarn; do
		write_stub "$name" <<-'EOF'
			#!/usr/bin/env bash
			printf '%s %s\n' "$(basename "$0")" "$*" >> "$NPM_CALL_LOG"
			echo "boom" >&2
			exit 1
		EOF
	done
}

# detect <expected> — run the audit and assert which manager it detected.
assert_detected() {
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"repo package manager: $1"* ]]
}

@test "detects the package manager from devEngines first" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	fail_all_stubs
	cat > "${WORKSPACE}/package.json" <<-'EOF'
		{"name":"root","devEngines":{"packageManager":{"name":"bun"}},"packageManager":"pnpm@11.0.0"}
	EOF
	touch "${WORKSPACE}/yarn.lock"
	assert_detected "bun via devEngines.packageManager"
}

@test "detects the package manager from the packageManager field before a lockfile" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	fail_all_stubs
	echo '{"name":"root","packageManager":"pnpm@11.0.0"}' > "${WORKSPACE}/package.json"
	touch "${WORKSPACE}/yarn.lock"
	assert_detected "pnpm via packageManager field"
}

@test "detects the package manager from a lockfile, then defaults to npm" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	fail_all_stubs
	touch "${WORKSPACE}/yarn.lock"
	assert_detected "yarn via yarn.lock"
	rm "${WORKSPACE}/yarn.lock"
	touch "${WORKSPACE}/pnpm-lock.yaml"
	assert_detected "pnpm via pnpm-lock.yaml"
	rm "${WORKSPACE}/pnpm-lock.yaml"
	assert_detected "npm via default"
}

@test "probes a pnpm repo with pnpm from the repo, never with npm" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	echo '{"name":"root","devEngines":{"packageManager":{"name":"pnpm"}}}' > "${WORKSPACE}/package.json"
	write_stub pnpm <<-'EOF'
		#!/usr/bin/env bash
		printf 'pnpm %s @ %s\n' "$*" "$PWD" >> "$NPM_CALL_LOG"
		printf '"0.2.1"\n'
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"1 warning(s)"* ]]
	[[ "$output" != *"UNVERIFIED"* ]]
	grep -q '^pnpm view @effected/glob@^0.2.0 version --json' "$NPM_CALL_LOG"
	! grep -q '^npm ' "$NPM_CALL_LOG"
}

@test "treats a pnpm no-matching-version JSON error as definitively none" {
	make_workspace "file:./artifact/pkg" "^0.3.0"
	echo '{"name":"root","packageManager":"pnpm@11.0.0"}' > "${WORKSPACE}/package.json"
	write_stub pnpm <<-'EOF'
		#!/usr/bin/env bash
		echo '{"error":{"code":"ERR_PNPM_PACKAGE_NOT_FOUND","message":"No matching version found for @effected/glob@^0.3.0"}}'
		exit 1
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"0 unverified probe(s)"* ]]
	[[ "$output" == *"0 warning(s)"* ]]
}

@test "probes a bun repo with bun info" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	echo '{"name":"root","packageManager":"bun@1.4.0"}' > "${WORKSPACE}/package.json"
	write_stub bun <<-'EOF'
		#!/usr/bin/env bash
		printf 'bun %s\n' "$*" >> "$NPM_CALL_LOG"
		printf '"0.2.1"\n'
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"1 warning(s)"* ]]
	grep -q '^bun info @effected/glob@^0.2.0 version --json' "$NPM_CALL_LOG"
}

@test "probes a yarn repo through npm, because yarn npm info cannot resolve ranges" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	echo '{"name":"root","packageManager":"yarn@4.18.1"}' > "${WORKSPACE}/package.json"
	export NPM_VIEW_OUTPUT='"0.2.1"'
	write_stub yarn <<-'EOF'
		#!/usr/bin/env bash
		echo "yarn" >> "$NPM_CALL_LOG"
		exit 1
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"1 warning(s)"* ]]
	grep -q '^view @effected/glob@^0.2.0 version --json' "$NPM_CALL_LOG"
	! grep -qx yarn "$NPM_CALL_LOG"
}

@test "probes an npm repo with npm from the repo, so its .npmrc applies" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	echo '{"name":"root","packageManager":"npm@11.0.0"}' > "${WORKSPACE}/package.json"
	write_stub npm <<-'EOF'
		#!/usr/bin/env bash
		printf 'npm %s @ %s\n' "$*" "$PWD" >> "$NPM_CALL_LOG"
		printf '"0.2.1"\n'
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"1 warning(s)"* ]]
	grep -q "@ ${WORKSPACE}\$" "$NPM_CALL_LOG"
}

@test "falls back to npm from outside the repo when the detected binary is missing" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	echo '{"name":"root","packageManager":"pnpm@11.0.0"}' > "${WORKSPACE}/package.json"
	write_stub npm <<-'EOF'
		#!/usr/bin/env bash
		printf 'npm %s @ %s\n' "$*" "$PWD" >> "$NPM_CALL_LOG"
		if grep -q packageManager package.json 2>/dev/null; then
			echo 'npm error code EBADDEVENGINES' >&2
			exit 1
		fi
		printf '"0.2.1"\n'
	EOF
	# A PATH holding only node and the stub's own tools: no pnpm resolves.
	mkdir -p "${BATS_TEST_TMPDIR}/node-only"
	for tool in node bash env grep; do
		ln -s "$(command -v "$tool")" "${BATS_TEST_TMPDIR}/node-only/$tool"
	done
	PATH="${STUB_BIN}:${BATS_TEST_TMPDIR}/node-only" run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"1 warning(s)"* ]]
	[[ "$output" != *"UNVERIFIED"* ]]
	! grep -q "@ ${WORKSPACE}\$" "$NPM_CALL_LOG"
}

@test "names the manager, the commands tried and EBADDEVENGINES when npm is the cause" {
	make_workspace "file:./artifact/pkg" "^0.2.0"
	fail_all_stubs
	write_stub npm <<-'EOF'
		#!/usr/bin/env bash
		echo 'npm error code EBADDEVENGINES' >&2
		exit 1
	EOF
	run node "$SCRIPT" "${WORKSPACE}/pnpm-workspace.yaml"
	[ "$status" -eq 0 ]
	[[ "$output" == *"npm view @effected/glob@^0.2.0 version --json"* ]]
}

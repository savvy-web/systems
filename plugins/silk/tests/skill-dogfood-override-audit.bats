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

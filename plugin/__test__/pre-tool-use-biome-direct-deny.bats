#!/usr/bin/env bats
# __test__/pre-tool-use-biome-direct-deny.bats
#
# Coverage for hooks/pre-tool-use/biome-direct-deny.sh: one rule, no
# exception, no heuristic -- deny exactly the commands that reach the biome
# binary directly (precisely detectable from the command string), and leave
# every package-manager script alone, since a script invocation always
# resolves package.json and therefore the repo's Biome config. Supersedes
# this hook's earlier incarnation (biome-npx-deny.sh, npx/bunx-only), and
# this hook's own first version on this branch, which also denied any
# package-manager script other than the three sanctioned names (e.g. `pnpm
# --filter <pkg> lint`) -- removed after probing showed it was backwards
# against the actual hazard (see the "left alone" section below). Coverage
# of the direct-route DENY is deliberately NOT keyed to this repo's package
# manager -- silk ships to pnpm, yarn, bun and npm consumers, and an agent
# routing around a refusal reaches for whichever runner is available.

load common

HOOK="hooks/pre-tool-use/biome-direct-deny.sh"
BASE_FIXTURE="${FIXTURES_DIR}/pretooluse.biome-bash-direct.json"

silk_file_setup() {
	common_setup
}

_decision() {
	jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision) // empty' <<< "$1"
}

_reason() {
	jq -r '(.hookSpecificOutput.permissionDecisionReason // .permissionDecisionReason) // empty' <<< "$1"
}

# _probe <command> <unique-session-id> -- build an envelope from
# BASE_FIXTURE with .tool_input.command and .session_id overridden (a unique
# session id per probe, not because this hook has session-keyed state, but
# so envelope files never collide across probes in the same test), run the
# hook, and leave $status/$output set by `run` for the caller to assert on.
_probe() {
	local cmd="$1" session="$2"
	local envelope="${SILK_TMP}/envelope-${session}.json"
	jq --arg cmd "$cmd" --arg sid "$session" \
		'.tool_input.command = $cmd | .session_id = $sid' \
		"$BASE_FIXTURE" > "$envelope"
	silk_run "$HOOK" "${envelope}"
}

_assert_allowed() {
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
}

_assert_denied() {
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"biome_check"* ]]
	[[ "$(_reason "$output")" == *"pnpm lint"* ]]
}

@test "non-Bash tool: silent noop" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-push-files.json"
	[ "$status" -eq 0 ]
	done
}

@test "biome mentioned inside a quoted argument: allowed (not command position)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.npx-biome-mention.json"
	_assert_allowed
	done
}

@test "unrelated command: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.non-bash-unrelated.json"
	_assert_allowed
	done
}

@test "biome mentioned only as a later argument, not command position: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "grep biome somefile.txt" "allow-grep-biome-argument"
	_assert_allowed
	done
}

# --- ALLOW: exactly the three sanctioned scripts, all four package managers,
#     bare and "run"-prefixed (savvy-web/systems house rule: pm x form) -----

@test "the sanctioned lint scripts are allowed for every package manager, bare and 'run'-prefixed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local pm script form cmd
	for pm in pnpm yarn bun npm; do
		for script in lint lint:fix lint:fix:unsafe; do
			for form in bare run; do
				if [ "$form" = "bare" ]; then
					cmd="${pm} ${script}"
				else
					cmd="${pm} run ${script}"
				fi
				_probe "$cmd" "allow-${pm}-${script//:/_}-${form}"
				[ "$status" -eq 0 ]
				[ "$(_decision "$output")" = "" ]
			done
		done
	done
	done
}

@test "pnpm lint itself is allowed (the repo's own documented lint command)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm lint" "allow-pnpm-lint-plain"
	_assert_allowed
	done
}

@test "npm lint (without run, not valid npm) is still allow-matched, no special-casing" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "npm lint" "allow-npm-lint-no-run"
	_assert_allowed
	done
}

# --- Script-name-shaped strings near "lint" never reach the direct-biome
#     check, decorated or not -----------------------------------------------
#
# This hook has exactly one check: does a segment, after peeling env/sudo/
# exec/runner prefixes, reduce to the biome binary. A package-manager script
# whose name merely starts with or resembles a sanctioned name -- "lint:fixme",
# "lint:evil", "lintfoo" -- never reduces to "biome" no matter what it's
# named, because peeling stops at the script name; there is no separate
# allowlist regex left to be exact or lax about. Pinned as a regression
# guard: a future version of this hook must not reintroduce a script-name
# heuristic that could be fooled by a look-alike name.

@test "pnpm lint:fixme: not denied (never reduces to the biome binary, whatever it's named)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm lint:fixme" "exact-pnpm-lint-fixme"
	_assert_allowed
	done
}

@test "pnpm lint:evil: not denied (same -- a script name is never mistaken for the binary)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm lint:evil" "exact-pnpm-lint-evil"
	_assert_allowed
	done
}

@test "pnpm lintfoo: not denied (no word boundary needed -- it's a script name, not a biome match)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm lintfoo" "exact-pnpm-lintfoo"
	_assert_allowed
	done
}

@test "yarn lint:fixme: not denied, same for every package manager" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "yarn lint:fixme" "exact-yarn-lint-fixme"
	_assert_allowed
	done
}

# --- Trailing arguments after a script name never trip the direct-biome
#     check either --------------------------------------------------------
#
# Real usage routinely appends flags or paths after a script name; since
# there is no script-name matching at all (see above), trailing content
# after "lint" is irrelevant to whether the segment reduces to "biome" --
# it doesn't, regardless of what follows the script name.

@test "pnpm lint --max-diagnostics=0: allowed (trailing flag after the script name)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm lint --max-diagnostics=0" "trailing-pnpm-lint-flag"
	_assert_allowed
	done
}

@test "pnpm run lint:fix -- --some-flag: allowed (trailing pass-through args)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm run lint:fix -- --some-flag" "trailing-pnpm-run-lint-fix-passthrough"
	_assert_allowed
	done
}

@test "pnpm lint packages/cli: allowed (trailing path argument)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm lint packages/cli" "trailing-pnpm-lint-path"
	_assert_allowed
	done
}

@test "npm run lint:fix:unsafe --silent: allowed (trailing flag, longest script name)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "npm run lint:fix:unsafe --silent" "trailing-npm-lint-fix-unsafe-flag"
	_assert_allowed
	done
}

# --- Chaining: an allowed segment does not blind the check to a later
#     segment in the same command. hook_split_segments isolates each
#     control-operator-delimited sub-command independently, so a sanctioned
#     script in one segment cannot smuggle a direct Biome invocation past
#     the hook in a later segment of the SAME Bash call. -------------------

@test "pnpm lint; npx biome check .: denied (the allowed first segment does not suppress the second)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm lint; npx biome check ." "chain-allow-then-npx-biome"
	_assert_denied
	done
}

@test "pnpm lint && sudo biome check .: denied (same, with && and a prefix-wrapped form)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm lint && sudo biome check ." "chain-allow-then-sudo-biome"
	_assert_denied
	done
}

@test "pnpm lint followed by a newline-separated biome check .: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe $'pnpm lint\nbiome check .' "chain-allow-then-newline-biome"
	_assert_denied
	done
}

# --- DENY: bare / PATH -------------------------------------------------------

@test "bare biome invocation: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "biome check ." "deny-bare-biome"
	_assert_denied
	done
}

@test "absolute-path biome invocation: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "/usr/local/bin/biome check ." "deny-abs-path-biome"
	_assert_denied
	done
}

@test "node_modules/.bin biome invocation: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "./node_modules/.bin/biome check ." "deny-node-modules-biome"
	_assert_denied
	done
}

# --- DENY: exec, all four package managers ----------------------------------

@test "pm exec biome is denied for every package manager" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local pm cmd
	for pm in pnpm npm yarn bun; do
		cmd="${pm} exec biome check ."
		_probe "$cmd" "deny-exec-${pm}"
		[ "$status" -eq 0 ]
		[ "$(_decision "$output")" = "deny" ]
	done
	done
}

# --- DENY: dlx / npx family --------------------------------------------------

@test "npx biome: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "npx biome check ." "deny-npx-biome"
	_assert_denied
	done
}

@test "bunx biome: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "bunx biome check ." "deny-bunx-biome"
	_assert_denied
	done
}

@test "bun x biome (two-token bunx alias): denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "bun x biome check ." "deny-bun-x-biome"
	_assert_denied
	done
}

@test "pnpm dlx biome: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm dlx biome check ." "deny-pnpm-dlx-biome"
	_assert_denied
	done
}

@test "yarn dlx biome: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "yarn dlx biome check ." "deny-yarn-dlx-biome"
	_assert_denied
	done
}

# --- DENY: real Biome via a scoped package name -- the deliberate reversal --
#
# Under the superseded npx-only rule these were the one deliberate carve-out
# (real Biome, not the 0.3.3 impostor). The user reversed that: real Biome
# invoked without the repo config is exactly the corruption hazard this hook
# exists to stop, scoped package name or not.

@test "npx @biomejs/biome: denied (reversal -- real Biome without the repo config is still the hazard)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "npx @biomejs/biome check ." "deny-npx-scoped-biome"
	_assert_denied
	done
}

@test "bunx @biomejs/biome: denied (same reversal)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "bunx @biomejs/biome check ." "deny-bunx-scoped-biome"
	_assert_denied
	done
}

# --- DENY: bare package manager + binary ------------------------------------

@test "pnpm biome (bare pm + binary): denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm biome check ." "deny-pnpm-biome"
	_assert_denied
	done
}

@test "yarn biome (bare pm + binary): denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "yarn biome check ." "deny-yarn-biome"
	_assert_denied
	done
}

@test "bun biome (bare pm + binary): denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "bun biome check ." "deny-bun-biome"
	_assert_denied
	done
}

# --- DENY: prefix-wrapped ----------------------------------------------------

@test "sudo biome: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "sudo biome check ." "deny-sudo-biome"
	_assert_denied
	done
}

@test "command biome: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "command biome check ." "deny-command-biome"
	_assert_denied
	done
}

@test "time biome: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "time biome check ." "deny-time-biome"
	_assert_denied
	done
}

@test "env biome: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "env biome check ." "deny-env-biome"
	_assert_denied
	done
}

@test "FOO=1 biome (inline VAR=value): denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "FOO=1 biome check ." "deny-inline-var-biome"
	_assert_denied
	done
}

@test "pnpm exec npx biome: denied (chained peel through exec then npx)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm exec npx biome check ." "deny-pnpm-exec-npx-biome"
	_assert_denied
	done
}

# --- DENY: chained / quoted --------------------------------------------------

@test "chained command (cd && npx biome): denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "cd /tmp && npx biome check ." "deny-chained-cd-npx-biome"
	_assert_denied
	done
}

@test "piped command (biome check . | cat): denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "biome check . | cat" "deny-piped-biome"
	_assert_denied
	done
}

@test "semicolon-chained command (echo hi; biome check .): denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "echo hi; biome check ." "deny-semicolon-biome"
	_assert_denied
	done
}

# --- Package-manager scripts are left alone entirely -----------------------
#
# One rule, no exception, no heuristic: this hook denies exactly what
# resolves to the biome binary directly. A package-manager script -- ANY
# script, sanctioned name or not, bare or decorated with --filter/-r, or a
# turbo task -- resolves package.json (and, for a workspace-scoped
# invocation, the workspace graph) before anything runs, so it always
# carries the repo's Biome config with it. Denying a decorated form of the
# sanctioned names while allowing every other script name through
# unexamined would be backwards against the actual hazard (config-less
# DIRECT invocation), which is exactly what an earlier version of this hook
# on this branch did -- caught by probing, not by reading the regex, and
# removed rather than made "smarter" about it, since the alternative is
# real script/task-graph resolution this hook does not have and should not
# approximate (a false deny blocks legitimate work; that is a worse failure
# than a missed nudge).

@test "pnpm --filter @savvy-web/cli lint: allowed (a package-manager script always resolves the repo config)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm --filter @savvy-web/cli lint" "allow-pnpm-filter-lint"
	_assert_allowed
	done
}

@test "pnpm -r lint: allowed (recursive workspace script, still config-safe)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm -r lint" "allow-pnpm-recursive-lint"
	_assert_allowed
	done
}

@test "pnpm --filter x lint:fix: allowed (decorated form of a sanctioned name is still just a script)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm --filter x lint:fix" "allow-pnpm-filter-lint-fix"
	_assert_allowed
	done
}

@test "turbo run lint: allowed (this is how CI runs it; turbo tasks resolve package.json scripts too)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "turbo run lint" "allow-turbo-run-lint"
	_assert_allowed
	done
}

@test "pnpm build (unrelated script name): allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm build" "allow-pnpm-build"
	_assert_allowed
	done
}

@test "pnpm add lint-staged (lint is a substring of a different token): allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "pnpm add lint-staged" "allow-pnpm-add-lint-staged"
	_assert_allowed
	done
}

# --- Deny message contract ---------------------------------------------------

@test "deny message names the MCP tool and all three sanctioned Bash scripts, and does NOT tell the caller to use pnpm exec biome" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe "biome check ." "deny-message-contract"
	local reason
	reason="$(_reason "$output")"
	[[ "$reason" == *"mcp__plugin_silk_savvy-mcp__biome_check"* ]]
	[[ "$reason" == *"pnpm lint"* ]]
	[[ "$reason" == *"pnpm lint:fix"* ]]
	[[ "$reason" == *"pnpm lint:fix:unsafe"* ]]
	[[ "$reason" != *"pnpm exec biome"* ]]
	[[ "$reason" == *".repos"* ]]
	done
}

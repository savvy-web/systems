#!/usr/bin/env bats
# __test__/pre-tool-use-repos-bash-guard.bats
#
# Coverage for hooks/pre-tool-use/repos-bash-guard.sh: a best-effort tripwire
# that denies shell commands whose COMMAND string visibly writes into
# "${PROJECT_DIR}/.repos/**" (vendored, read-only reference source).
# ".repos/config.json" stays hand-editable. This is NOT a security boundary
# -- see the header comment in repos-bash-guard.sh for the accepted,
# documented misses (persisted `cd`, command substitution, exotic
# indirection). Unlike biome-prefer-mcp.sh, this hook does NOT exempt
# subagent calls.
#
# Deny-path fixture pattern copied from pre-tool-use-repos-fs-guard.bats --
# see tests/README.md "Deny-path fixture pattern".

load common

HOOK="hooks/pre-tool-use/repos-bash-guard.sh"

silk_file_setup() {
	common_setup
}

_decision() {
	jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision) // empty' <<< "$1"
}

_reason() {
	jq -r '(.hookSpecificOutput.permissionDecisionReason // .permissionDecisionReason) // empty' <<< "$1"
}

run_guard_with_envelope() {
	local envelope="$1"
	# Hook assertions are over stdout JSON/no-op only; stderr diagnostics vary by
	# host shell/tooling and are not part of the contract this suite validates.
	silk_run "$HOOK" "$envelope"
}

# run_guard_with_command <command> — synthesize a Bash PreToolUse envelope
# with .tool_input.command set to <command> (jq --arg, so embedded
# newlines/quotes survive untouched), run it through the hook, and
# set $output/$status per bats' `run`.
run_guard_with_command() {
	run_guard_with_tool_and_command "Bash" "$1"
}

run_guard_with_tool_and_command() {
	local tool_name="$1" command="$2"
	local envelope
	envelope="${SILK_TMP}/envelope-command.json"
	jq -n --arg tool "$tool_name" --arg c "$command" '{
		session_id: "test-repos-bash-command",
		hook_event_name: "PreToolUse",
		tool_name: $tool,
		tool_input: {
			command: $c
		}
	}' > "$envelope"
	run_guard_with_envelope "$envelope"
}

assert_allow() {
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

assert_deny() {
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "git -C .repos/<repo> checkout (write subcommand): deny naming repos_manage pin" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "git -C .repos/effect checkout -b x"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"repos_manage"* ]]
	[[ "$reason" == *"pin"* ]]
	done
}

@test "git -C .repos/<repo> log (read subcommand, allow-listed): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "git -C .repos/effect log --oneline"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "shell redirect into .repos/** : deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "echo broken > .repos/effect/src/index.ts"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "sed -i targeting .repos/** : deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "sed -i '' 's/a/b/' .repos/effect/README.md"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "redirect append into .repos/config.json (the hand-editable exception): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "echo note >> .repos/config.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "redirect append into .repos/config.json.bak (adjacent filename, NOT the exact exemption): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "echo x >> .repos/config.json.bak"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "redirect append into .repos/config.jsonX (suffix, NOT the exact exemption): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "echo x >> .repos/config.jsonX"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "sed -i with the flag reordered after the script arg: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "sed -e 's/a/b/' -i .repos/effect/README.md"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "git --git-dir=<abs>/.repos/<repo>/.git checkout (write subcommand): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "git --git-dir=/x/.repos/effect/.git checkout -b y"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "git --work-tree=<abs>/.repos/<repo> status (read subcommand): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "git --work-tree=/x/.repos/effect status"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "rg read over .repos/** : silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "rg pattern .repos/effect"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "command with no .repos mention: silent no-op (cheap early-out)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "pnpm build"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "git rm --cached .repos/<repo> (index-only gitlink removal): silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "git rm --cached .repos/effect"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "git rm .repos/<repo> (no --cached, deletes working-tree file too): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "git rm .repos/effect"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "git mv .repos/<repo> .repos/<repo> (#377, raw git mv stays denied — use repos_manage rename): deny with the lifecycle message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "git mv .repos/effect .repos/effect-renamed"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
	done
}

@test "git mv OUT of .repos (#377): deny with the lifecycle message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git mv .repos/effect /tmp/effect'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
	done
}

@test "git mv INTO .repos (#377): deny with the lifecycle message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git mv /tmp/x .repos/effect/x'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
	done
}

@test "git reset --hard against a vendored path (#293, use repos_manage restore): deny with the lifecycle message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git reset --hard HEAD -- .repos/effect'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
	[[ "$reason" == *"restore"* ]]
	done
}

@test "git clean -fd against a vendored path (#293, use repos_manage restore): deny with the lifecycle message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git clean -fd .repos/effect'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
	[[ "$reason" == *"restore"* ]]
	done
}

@test "bare rm -rf .repos/<repo> (no git involved): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "rm -rf .repos/effect"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "git status && rm -rf .repos/<repo> (rm in a later, unrelated clause): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "git status && rm -rf .repos/effect"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "git status && git checkout HEAD -- .repos/effect (subcommand must anchor to the .repos-targeting clause, not the first git): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git status && git checkout HEAD -- .repos/effect'
	assert_deny
	done
}

@test "git checkout HEAD -- .repos/effect && git status (the .repos-targeting git is first here too): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git checkout HEAD -- .repos/effect && git status'
	assert_deny
	done
}

@test "git status && git log .repos/effect (later clause is a read op): allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git status && git log .repos/effect'
	assert_allow
	done
}

@test "git -C .repos/effect log && git -C .repos/effect reset --hard HEAD (read clause first, write clause second, &&): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect log && git -C .repos/effect reset --hard HEAD'
	assert_deny
	done
}

@test "git -C .repos/effect log; git -C .repos/effect reset --hard HEAD (read clause first, write clause second, ;): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect log; git -C .repos/effect reset --hard HEAD'
	assert_deny
	done
}

@test "git -C .repos/effect log || git -C .repos/effect reset --hard HEAD (read clause first, write clause second, ||): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect log || git -C .repos/effect reset --hard HEAD'
	assert_deny
	done
}

@test "git -C .repos/effect log && git -C .repos/effect rm -rf . (read-then-rm bypass, &&): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect log && git -C .repos/effect rm -rf .'
	assert_deny
	done
}

@test "git -C .repos/effect log && git -C .repos/effect mv old new (read-then-mv bypass, &&): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect log && git -C .repos/effect mv old new'
	assert_deny
	done
}

@test "git -C .repos/effect log && git -C .repos/effect submodule deinit -- . (read-then-deinit bypass, &&): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect log && git -C .repos/effect submodule deinit -- .'
	assert_deny
	done
}

@test "non-Bash tool_name: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_tool_and_command "mcp__gitkraken__git_add_or_commit" ""
	[ "$status" -eq 0 ]
	[ -z "$output" ]
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

@test "heredoc body mentioning .repos does not deny a write elsewhere (#411)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command $'cat >> .superpowers/notes.md <<\'EOF\'\nthe guard denies rm -rf .repos/effect\nEOF'
	assert_allow
	done
}

@test "gh issue create with .repos prose in --body is allowed (#423, #357)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'gh issue create --repo o/r --title t --body "run git rm -f .repos/effect to reproduce"'
	assert_allow
	done
}

@test "cp OUT of .repos is allowed (#325)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'cp .repos/effect/packages/effect/src/Context.ts /tmp/ctx.ts'
	assert_allow
	done
}

@test "cp INTO .repos is denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'cp /tmp/x.ts .repos/effect/packages/effect/src/x.ts'
	assert_deny
	done
}

@test "cp INTO .repos followed by a chained clause is still denied (clause-scoped last-operand)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'cp a.ts .repos/effect/src/a.ts && echo done'
	assert_deny
	done
}

@test "cp OUT of .repos followed by a chained clause is still allowed (clause scoping does not over-reach)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'cp .repos/effect/src/a.ts /tmp/x.ts && echo done'
	assert_allow
	done
}

@test "mv whose destination is .repos is denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'mv /tmp/dir .repos/effect/vendor'
	assert_deny
	done
}

@test "redirect into .repos/config.json is allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'jq . < input.json > .repos/config.json'
	assert_allow
	done
}

@test "redirect into a vendored tree is still denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'echo x > .repos/effect/README.md'
	assert_deny
	done
}

@test "rm -rf of a vendored tree is still denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'rm -rf .repos/effect'
	assert_deny
	done
}

@test "quoted path without whitespace is still seen: rm of quoted vendored path denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'rm -rf ".repos/effect"'
	assert_deny
	done
}

@test "git add .repos/config.json is allowed (#379)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git add .repos/config.json'
	assert_allow
	done
}

@test "git add of config.json plus a vendored path stays denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git add .repos/config.json .repos/effect'
	assert_deny
	done
}

@test "git restore --staged .repos/config.json is allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git restore --staged .repos/config.json'
	assert_allow
	done
}

@test "git diff .repos/config.json is allowed (#423)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git diff .repos/config.json'
	assert_allow
	done
}

@test "bare git rm on a vendored path denies with the lifecycle message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git rm -f .repos/effect'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
	done
}

@test "git submodule deinit denies with the lifecycle message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git submodule deinit -f .repos/effect'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
	done
}

@test "here-string does not arm the heredoc stripper, later write still denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command $'jq . <<< foo\nrm -rf .repos/effect'
	assert_deny
	done
}

@test "here-string with .repos only as a read source (single line) is allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'jq . <<< "$(cat .repos/effect/package.json)"'
	assert_allow
	done
}

@test "glued |tee into .repos is denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'echo x|tee .repos/effect/f'
	assert_deny
	done
}

@test "glued |tee with .repos mentioned only as a read elsewhere is allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'cat .repos/effect/README.md|echo x|tee /tmp/out.txt'
	assert_allow
	done
}

@test "tee's own segment is a plain write, .repos read is in a LATER pipeline segment: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'tee /tmp/out | cat .repos/effect/README.md'
	assert_allow
	done
}

@test "echo piped into tee targeting .repos is still denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'echo x | tee .repos/effect/f'
	assert_deny
	done
}

@test "tee in a LATER pipeline segment with a .repos operand is denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'cat x | tee /tmp/out | tee .repos/effect/f'
	assert_deny
	done
}

@test "cp -t naming a .repos destination is denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'cp -t .repos/dir src.ts'
	assert_deny
	done
}

@test "cp -t copying OUT of .repos to a non-.repos destination is allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'cp -t /tmp .repos/effect/README.md'
	assert_allow
	done
}

@test "sibling clause --cached does not exempt a bare git rm in another clause" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git rm .repos/effect/README.md && git rm --cached .repos/config.json'
	assert_deny
	done
}

@test "clause-local --cached still exempts the index-only git rm shape" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git rm --cached .repos/effect && git status'
	assert_allow
	done
}

@test "manifest staging clause is allowed despite a vendored read in a sibling clause" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git add .repos/config.json && git log .repos/effect'
	assert_allow
	done
}

# --- Mode-dependent subcommands (#458) -------------------------------------
# `config`, `submodule` and `remote` are read-or-write depending on their
# flags/subverb, so the by-name read-ops list cannot classify them. See
# _repos_clause_is_read in the guard.

@test "git config --get on a submodule key (the key embeds .repos/ by construction): allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --local --get submodule..repos/effect.url'
	assert_allow
	done
}

@test "git config --get-regexp matching a submodule key: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --local --get-regexp submodule..repos/effect'
	assert_allow
	done
}

@test "git config --list is a read even when a .repos key is named: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --list --show-origin .repos/effect'
	assert_allow
	done
}

# --unset/--unset-all/--remove-section on a submodule key are the sanctioned
# deregistration (covered below); every OTHER config write verb still denies,
# including on a submodule key. Removal clears a stale registration; altering
# one is `sync`'s job.
@test "git config --replace-all on a submodule key (a write, not a removal): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --replace-all submodule..repos/effect.url https://evil.example/x.git'
	assert_deny
	done
}

@test "git config bare name/value two-positional form (the real write shape): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config submodule..repos/effect.url https://evil.example/x.git'
	assert_deny
	done
}

@test "git config --get paired with a non-removal write in the same clause: deny (write flag wins)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --get submodule..repos/effect.url --add core.hooksPath .repos/effect/hooks'
	assert_deny
	done
}

@test "git submodule status (the read that diagnoses nested divergence): allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect submodule status'
	assert_allow
	done
}

@test "git submodule summary against a vendored tree: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect submodule summary'
	assert_allow
	done
}

@test "git submodule deinit still denies with the unvendoring lifecycle message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect submodule deinit --all'
	assert_deny
	[[ "$(_reason "$output")" == *"unvendoring"* ]]
	done
}

@test "git submodule update against a vendored tree: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect submodule update --init --recursive'
	assert_deny
	done
}

@test "git remote -v against a vendored tree (read): allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect remote -v'
	assert_allow
	done
}

@test "git remote get-url against a vendored tree (read): allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect remote get-url origin'
	assert_allow
	done
}

@test "git remote set-url against a vendored tree (was permitted by the by-name list): deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect remote set-url origin https://evil.example/x.git'
	assert_deny
	done
}

@test "git remote add against a vendored tree: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git -C .repos/effect remote add mirror https://evil.example/x.git'
	assert_deny
	done
}

@test "a config read in one clause does not clear a config write in a sibling clause" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --get submodule..repos/effect.url && git config submodule..repos/effect.url https://evil.example/x.git'
	assert_deny
	done
}

# --- sed script vs sed file operand ----------------------------------------
# A sed SCRIPT is not a path. Scanning every token for ".repos/" denied a
# rename whose expression mentioned the vendored dir while every file operand
# sat outside it. Positional parsing can't resolve this (BSD `-i ''` takes a
# suffix argument GNU `-i` does not), so the script is recognized by shape.

@test "sed -i whose EXPRESSION mentions .repos/ but whose targets are outside it: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "sed -i '' 's|.repos/effect-smol|.repos/effect|g' plugins/silk/hooks/fixtures/a.json"
	assert_allow
	done
}

@test "sed -i with a .repos/ expression, GNU form, non-vendored target: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "sed -i 's|.repos/old|.repos/new|' packages/x.ts"
	assert_allow
	done
}

@test "sed -i with a .repos/ expression AND a .repos/ FILE operand: still denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "sed -i 's|.repos/old|.repos/new|' .repos/effect/README.md"
	assert_deny
	done
}

@test "sed -i with an ordinary expression and a .repos/ file operand: still denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "sed -i 's/a/b/' .repos/effect/README.md"
	assert_deny
	done
}

@test "a path token that merely starts with s is not mistaken for a sed script" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "sed -i 's/a/b/' src/.repos/effect/x.ts"
	assert_deny
	done
}

@test "the sed script exemption does not leak to rm" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command "rm -rf .repos/effect"
	assert_deny
	done
}

# --- deregistering a stale submodule section (the drift remedy) ------------
# ReposDrift reports an orphaned submodule.<name>.* section and names
# `git config --remove-section` as the fix; nothing else can perform it, so
# denying it left a detected drift with no sanctioned remedy. The write lands
# in the superproject's .git/config, never inside .repos/**.

@test "git config --remove-section on a stale submodule section: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --remove-section submodule..repos/effect-smol'
	assert_allow
	done
}

@test "git config --unset of a submodule registration key: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --local --unset submodule..repos/effect-smol.url'
	assert_allow
	done
}

@test "git config --unset-all of a submodule registration key: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --unset-all submodule..repos/effect-smol.active'
	assert_allow
	done
}

@test "the deregister allowance is local-config only: an -f .gitmodules unset denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config -f .gitmodules --unset submodule..repos/effect.url'
	assert_deny
	done
}

@test "the deregister allowance is removal-only: setting a registration still denies" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config submodule..repos/effect.url https://evil.example/x.git'
	assert_deny
	done
}

@test "the deregister allowance covers submodule KEYS only, not path operands" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --unset core.thing .repos/effect/f'
	assert_deny
	done
}

# The deregister allowance's local-config test is per-TOKEN and prefix-matched.
# A regex over the clause let four forms through: an attached -f<path> (no space
# and no "=", so a `(-f|--file)([[:space:]]|=)` test never fired) and all three
# non-local scopes, which went unchecked. The attached form is the dangerous one
# — it writes .gitmodules, tracked host content.

@test "deregister allowance denies an ATTACHED -f<path>" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config -f.gitmodules --unset submodule..repos/effect.url'
	assert_deny
	done
}

@test "deregister allowance denies --file=<path>" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --file=.gitmodules --unset submodule..repos/effect.url'
	assert_deny
	done
}

@test "deregister allowance denies a separated -f <path>" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config -f .gitmodules --unset submodule..repos/effect.url'
	assert_deny
	done
}

@test "deregister allowance denies --global scope" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --global --unset submodule..repos/effect.url'
	assert_deny
	done
}

@test "deregister allowance denies --system scope" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --system --remove-section submodule..repos/effect'
	assert_deny
	done
}

@test "deregister allowance denies --worktree scope" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --worktree --unset submodule..repos/effect.url'
	assert_deny
	done
}

@test "an explicit --local deregister is still allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_guard_with_command 'git config --local --remove-section submodule..repos/effect-smol'
	assert_allow
	done
}

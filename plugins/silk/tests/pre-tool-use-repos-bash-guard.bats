#!/usr/bin/env bats
# tests/pre-tool-use-repos-bash-guard.bats
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

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/repos-bash-guard.sh"

setup() {
	common_setup
}

_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

_reason() {
	jq -r '.hookSpecificOutput.permissionDecisionReason // empty' <<< "$1"
}

# run_guard_with_command <command> — derive an envelope from the redirect
# fixture with .tool_input.command replaced by <command> (jq --arg, so
# embedded newlines/quotes survive untouched), pipe it through the hook, and
# set $output/$status per bats' `run`. Mirrors the "derive with jq rather
# than a near-duplicate fixture" convention in tests/README.md.
run_guard_with_command() {
	local envelope
	envelope="${BATS_TEST_TMPDIR}/envelope-command.json"
	jq --arg c "$1" '.tool_input.command = $c' \
		"${FIXTURES_DIR}/pretooluse.repos-bash-redirect.json" > "$envelope"
	run bash -c "cat '${envelope}' | bash '${HOOK}'"
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
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-write.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"repos_manage"* ]]
	[[ "$reason" == *"pin"* ]]
}

@test "git -C .repos/<repo> log (read subcommand, allow-listed): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-read.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "shell redirect into .repos/** : deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-redirect.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "sed -i targeting .repos/** : deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-sed.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "redirect append into .repos/config.json (the hand-editable exception): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-config-allow.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "redirect append into .repos/config.json.bak (adjacent filename, NOT the exact exemption): deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-config-bak-deny.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "redirect append into .repos/config.jsonX (suffix, NOT the exact exemption): deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-config-suffix-deny.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "sed -i with the flag reordered after the script arg: deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-sed-reordered.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "git --git-dir=<abs>/.repos/<repo>/.git checkout (write subcommand): deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-dir-write.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "git --work-tree=<abs>/.repos/<repo> status (read subcommand): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-worktree-read.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "rg read over .repos/** : silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-rg.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "command with no .repos mention: silent no-op (cheap early-out)" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-unrelated.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "git rm --cached .repos/<repo> (index-only gitlink removal): silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-rm-cached.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "git rm .repos/<repo> (no --cached, deletes working-tree file too): deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-rm-no-cached.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "git mv .repos/<repo> .repos/<repo> (#377, rename is no longer a sanctioned primitive): deny with the lifecycle message" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-mv.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
}

@test "git mv OUT of .repos (#377): deny with the lifecycle message" {
	run_guard_with_command 'git mv .repos/effect /tmp/effect'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
}

@test "git mv INTO .repos (#377): deny with the lifecycle message" {
	run_guard_with_command 'git mv /tmp/x .repos/effect/x'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
}

@test "bare rm -rf .repos/<repo> (no git involved): deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-rm-rf.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "git status && rm -rf .repos/<repo> (rm in a later, unrelated clause): deny" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-bash-git-then-chained-rm.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "git status && git checkout HEAD -- .repos/effect (subcommand must anchor to the .repos-targeting clause, not the first git): deny" {
	run_guard_with_command 'git status && git checkout HEAD -- .repos/effect'
	assert_deny
}

@test "git checkout HEAD -- .repos/effect && git status (the .repos-targeting git is first here too): deny" {
	run_guard_with_command 'git checkout HEAD -- .repos/effect && git status'
	assert_deny
}

@test "git status && git log .repos/effect (later clause is a read op): allowed" {
	run_guard_with_command 'git status && git log .repos/effect'
	assert_allow
}

@test "non-Bash tool_name: silent no-op" {
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.repos-mcp-write.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "malformed JSON input: no-op (fails open)" {
	run bash -c "printf 'not json' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "heredoc body mentioning .repos does not deny a write elsewhere (#411)" {
	run_guard_with_command $'cat >> .superpowers/notes.md <<\'EOF\'\nthe guard denies rm -rf .repos/effect\nEOF'
	assert_allow
}

@test "gh issue create with .repos prose in --body is allowed (#423, #357)" {
	run_guard_with_command 'gh issue create --repo o/r --title t --body "run git rm -f .repos/effect to reproduce"'
	assert_allow
}

@test "cp OUT of .repos is allowed (#325)" {
	run_guard_with_command 'cp .repos/effect/packages/effect/src/Context.ts /tmp/ctx.ts'
	assert_allow
}

@test "cp INTO .repos is denied" {
	run_guard_with_command 'cp /tmp/x.ts .repos/effect/packages/effect/src/x.ts'
	assert_deny
}

@test "cp INTO .repos followed by a chained clause is still denied (clause-scoped last-operand)" {
	run_guard_with_command 'cp a.ts .repos/effect/src/a.ts && echo done'
	assert_deny
}

@test "cp OUT of .repos followed by a chained clause is still allowed (clause scoping does not over-reach)" {
	run_guard_with_command 'cp .repos/effect/src/a.ts /tmp/x.ts && echo done'
	assert_allow
}

@test "mv whose destination is .repos is denied" {
	run_guard_with_command 'mv /tmp/dir .repos/effect/vendor'
	assert_deny
}

@test "redirect into .repos/config.json is allowed" {
	run_guard_with_command 'jq . < input.json > .repos/config.json'
	assert_allow
}

@test "redirect into a vendored tree is still denied" {
	run_guard_with_command 'echo x > .repos/effect/README.md'
	assert_deny
}

@test "rm -rf of a vendored tree is still denied" {
	run_guard_with_command 'rm -rf .repos/effect'
	assert_deny
}

@test "quoted path without whitespace is still seen: rm of quoted vendored path denied" {
	run_guard_with_command 'rm -rf ".repos/effect"'
	assert_deny
}

@test "git add .repos/config.json is allowed (#379)" {
	run_guard_with_command 'git add .repos/config.json'
	assert_allow
}

@test "git add of config.json plus a vendored path stays denied" {
	run_guard_with_command 'git add .repos/config.json .repos/effect'
	assert_deny
}

@test "git restore --staged .repos/config.json is allowed" {
	run_guard_with_command 'git restore --staged .repos/config.json'
	assert_allow
}

@test "git diff .repos/config.json is allowed (#423)" {
	run_guard_with_command 'git diff .repos/config.json'
	assert_allow
}

@test "bare git rm on a vendored path denies with the lifecycle message" {
	run_guard_with_command 'git rm -f .repos/effect'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
}

@test "git submodule deinit denies with the lifecycle message" {
	run_guard_with_command 'git submodule deinit -f .repos/effect'
	assert_deny
	local reason; reason="$(_reason "$output")"
	[[ "$reason" == *"lifecycle"* ]]
}

@test "here-string does not arm the heredoc stripper, later write still denies" {
	run_guard_with_command $'jq . <<< foo\nrm -rf .repos/effect'
	assert_deny
}

@test "here-string with .repos only as a read source (single line) is allowed" {
	run_guard_with_command 'jq . <<< "$(cat .repos/effect/package.json)"'
	assert_allow
}

@test "glued |tee into .repos is denied" {
	run_guard_with_command 'echo x|tee .repos/effect/f'
	assert_deny
}

@test "glued |tee with .repos mentioned only as a read elsewhere is allowed" {
	run_guard_with_command 'cat .repos/effect/README.md|echo x|tee /tmp/out.txt'
	assert_allow
}

@test "tee's own segment is a plain write, .repos read is in a LATER pipeline segment: allowed" {
	run_guard_with_command 'tee /tmp/out | cat .repos/effect/README.md'
	assert_allow
}

@test "echo piped into tee targeting .repos is still denied" {
	run_guard_with_command 'echo x | tee .repos/effect/f'
	assert_deny
}

@test "tee in a LATER pipeline segment with a .repos operand is denied" {
	run_guard_with_command 'cat x | tee /tmp/out | tee .repos/effect/f'
	assert_deny
}

@test "cp -t naming a .repos destination is denied" {
	run_guard_with_command 'cp -t .repos/dir src.ts'
	assert_deny
}

@test "cp -t copying OUT of .repos to a non-.repos destination is allowed" {
	run_guard_with_command 'cp -t /tmp .repos/effect/README.md'
	assert_allow
}

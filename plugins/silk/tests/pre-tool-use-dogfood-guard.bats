#!/usr/bin/env bats
# tests/pre-tool-use-dogfood-guard.bats
#
# Coverage for hooks/pre-tool-use/dogfood-guard.sh: deny `git push` /
# `gh pr create|edit` (Bash), the GitKraken MCP equivalents (`git_push`,
# `pull_request_create`), and the GitHub MCP server's `create_pull_request` /
# `update_pull_request` / `push_files`.
#
# The guard is keyed on TREE STATE, not journal role/phase alone
# (savvy-web/systems#387 / #332 / #331 -- see the header comment in
# dogfood-guard.sh for the full decision table): a `file:`/`link:` override
# escaping the repo in pnpm-workspace.yaml's `overrides:` block denies on any
# branch but `dev`; `dev` is exempt unconditionally; a clean tree with a
# downstream, non-"unlinked" journal allows WITH a warning; a downstream
# journal whose packagesDerived is explicitly false denies even on a clean
# tree. This is a TRIPWIRE, not a security boundary -- see the header comment
# in dogfood-guard.sh. Deny-path fixture pattern copied from
# pre-tool-use-repos-bash-guard.bats -- see tests/README.md "Deny-path
# fixture pattern".

load 'test_helper'

HOOK="${HOOKS_DIR}/pre-tool-use/dogfood-guard.sh"

setup() {
	common_setup
}

_decision() {
	jq -r '.hookSpecificOutput.permissionDecision // empty' <<< "$1"
}

_reason() {
	jq -r '.hookSpecificOutput.permissionDecisionReason // empty' <<< "$1"
}

_context() {
	jq -r '.hookSpecificOutput.additionalContext // empty' <<< "$1"
}

# write_journal <project> <loop-id> <role> <phase> [round] -- append one
# snapshot line to .claude/dogfood/<loop-id>.jsonl, minimal shape (only the
# fields this hook reads plus enough to look like a real snapshot). Carries
# NO packagesDerived field -- exercises the "absent" state of that three-state
# field (upstream journals, and downstream journals written before the field
# existed).
write_journal() {
	local project="$1" loop_id="$2" role="$3" phase="$4" round="${5:-1}"
	local dir="${project}/.claude/dogfood"
	mkdir -p "$dir"
	jq -nc --arg role "$role" --arg phase "$phase" --argjson round "$round" \
		'{at: "2026-07-16T00:00:00Z", event: "phase-change", role: $role, phase: $phase, ball: "ours", round: $round}' \
		>> "${dir}/${loop_id}.jsonl"
}

# write_journal_full <project> <loop-id> <role> <phase> <packagesDerived> --
# same as write_journal but with an explicit boolean packagesDerived field.
write_journal_full() {
	local project="$1" loop_id="$2" role="$3" phase="$4" derived="$5"
	local dir="${project}/.claude/dogfood"
	mkdir -p "$dir"
	jq -nc --arg role "$role" --arg phase "$phase" --argjson derived "$derived" \
		'{at:"2026-08-02T00:00:00Z", event:"phase-change", role:$role, phase:$phase,
		  ball:"ours", round:1, packages:[], packagesDerived:$derived}' \
		>> "${dir}/${loop_id}.jsonl"
}

# write_override <project> -- put a machine-local file: override in the tree.
write_override() {
	cat > "${1}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - "packages/*"
		overrides:
		  "@effected/glob": "file:../../spencerbeggs/effected/packages/glob/dist/prod/npm/pkg"
	EOF
}

# write_override_commented_out <project> -- an override commented out inside
# an otherwise active overrides: block (the SKILL.md --exit alternative of
# commenting instead of deleting the entry).
write_override_commented_out() {
	cat > "${1}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - "packages/*"
		overrides:
		  # "@effected/glob": "file:../../spencerbeggs/effected/packages/glob/dist/prod/npm/pkg"
		  "@microsoft/api-extractor>typescript": ^6.0.3
	EOF
}

# write_override_trailing_comment_only <project> -- no live override; a
# trailing comment merely RECALLS a past file: link on an unrelated entry.
write_override_trailing_comment_only() {
	cat > "${1}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - "packages/*"
		overrides:
		  "real": "^1.0.0"  # was file:../../effected while dogfooding
	EOF
}

# write_override_with_trailing_comment <project> -- a REAL override, with a
# trailing comment on the same line -- proves comment-stripping doesn't
# swallow a live match too.
write_override_with_trailing_comment() {
	cat > "${1}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - "packages/*"
		overrides:
		  "@effected/glob": "file:../../spencerbeggs/effected/packages/glob/dist/prod/npm/pkg"  # active loop
	EOF
}

# write_override_quoted_hash <project> -- a REAL override whose quoted value
# happens to contain a whitespace-preceded `#` BEFORE the file: token. Proves
# the comment strip is quote-aware, not a bare whitespace-gated cut that
# would truncate the value and miss the override.
write_override_quoted_hash() {
	cat > "${1}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - "packages/*"
		overrides:
		  "@e/g": "weird #value file:../../spencerbeggs/effected/x"
	EOF
}

# write_override_escaped_quote <project> -- a REAL override whose value
# contains an ESCAPED double-quote (\") before its whitespace-preceded `#`.
# Proves the quote tracker does not mistake the escaped quote for the
# closing quote, which would flip in-quote state early and expose the `#`
# as a comment start, truncating the file: token away. This is the
# MISSED-DENY direction of the escaped-quote gap.
write_override_escaped_quote() {
	cat > "${1}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - "packages/*"
		overrides:
		  "@e/g": "esc \" #v file:../../spencerbeggs/effected/x"
	EOF
}

# write_override_escaped_quote_then_comment <project> -- an override whose
# value contains an escaped double-quote BEFORE its real closing quote, with
# a genuine trailing comment (no live link) afterward. Without escape
# awareness, the escaped quote is miscounted as the closing quote, the real
# closing quote is then miscounted as a NEW opening quote, and the tracker
# ends the line still believing itself inside quotes -- so the trailing
# comment's file: mention is never recognized as a comment and is matched as
# if it were live. This is the FALSE-DENY direction of the same gap; there
# is no live override here at all.
write_override_escaped_quote_then_comment() {
	cat > "${1}/pnpm-workspace.yaml" <<-'EOF'
		packages:
		  - "packages/*"
		overrides:
		  "@e/g": "note \" trailing" # file:../../evil-but-comment
	EOF
}

# append_raw <project> <loop-id> <raw-line> -- append a literal line (used to
# construct corrupt-tail / empty-file scenarios that write_journal's jq
# construction can't express).
append_raw() {
	local project="$1" loop_id="$2" raw="$3"
	local dir="${project}/.claude/dogfood"
	mkdir -p "$dir"
	printf '%s\n' "$raw" >> "${dir}/${loop_id}.jsonl"
}

@test "no .claude/dogfood directory: silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "dogfood dir present but no *.jsonl journals: silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	mkdir -p "${project}/.claude/dogfood"
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "unrelated Bash command (git status): silent no-op even with an active downstream loop" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.bash-safe.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "unrelated MCP op (git_status): silent no-op even with an active downstream loop" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gitkraken-read.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "'push' appears only inside a commit message, not as the git subcommand: silent no-op" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-push-mention-only.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "non-Bash, non-MCP tool_name: silent no-op" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-empty.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "malformed JSON input: no-op (fails open)" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "printf 'not json' | bash '${HOOK}' 2>/dev/null"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
}

@test "downstream + requested, clean tree: git push allowed with warning naming loop id, phase, and --exit" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream requested
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	local ctx; ctx="$(_context "$output")"
	[[ "$ctx" == *"effected"* ]]
	[[ "$ctx" == *"requested"* ]]
	[[ "$ctx" == *"/silk:dogfood --exit"* ]]
}

@test "downstream + implementing, clean tree: git push (with global flag + force) allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream implementing
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-flags.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + handoff, clean tree: gh pr create allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream handoff
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-gh-pr-create.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + adopting, clean tree: gh pr edit allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-gh-pr-edit.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + findings, clean tree: MCP git_push allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream findings
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.mcp-gitkraken-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + upstream-pr, clean tree: MCP pull_request_create allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream upstream-pr
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-pull-request-create.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + handoff, clean tree: GitHub MCP create_pull_request allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream handoff
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-create-pull-request.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + adopting, clean tree: scoped GitHub MCP update_pull_request allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-update-pull-request.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + findings, clean tree: GitHub MCP push_files allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream findings
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-push-files.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + unlinked (terminal): GitHub MCP create_pull_request silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-create-pull-request.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "no active dogfood loop: GitHub MCP push_files silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-push-files.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "downstream + released, clean tree: git push allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream released
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "downstream + unlinked (terminal): silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "upstream role, any active phase: silent allow (upstream is not push-guarded)" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected upstream upstream-pr
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "multiple journals, only the second is an active downstream loop, clean tree: allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" clean-upstream upstream implementing
	write_journal "$project" effected downstream adopting
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	local ctx; ctx="$(_context "$output")"
	[[ "$ctx" == *"effected"* ]]
}

@test "corrupt tail line walks back to the previous valid (still-active) snapshot, clean tree: allowed with warning" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	append_raw "$project" effected '{"at": "2026-07-16T01:00:00Z", "event": "mail-sent"'  # truncated / malformed
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

@test "corrupt tail line walks back to a now-unlinked snapshot: silent allow" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	append_raw "$project" effected 'not even json'
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "journal with no valid line at all: allow (fail-open), warning logged" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	append_raw "$project" effected 'not json at all'
	append_raw "$project" effected '{"broken": '
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	run cat "$SILK_HOOK_ERROR_LOG"
	[[ "$output" == *"no valid JSONL line"* ]]
}

@test "empty journal file: allow (fail-open), no crash" {
	make_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	mkdir -p "${project}/.claude/dogfood"
	: > "${project}/.claude/dogfood/effected.jsonl"
	run bash -c "cat '${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "file: override present on a non-dev branch: denied" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
}

@test "commented-out override inside an active overrides block: allowed (not a live link)" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_commented_out "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
}

@test "trailing comment merely recalling a past file: link: allowed (no live override)" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_trailing_comment_only "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
}

@test "real override plus a trailing comment: still denied (comment-stripping doesn't weaken real detection)" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_with_trailing_comment "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
}

@test "quoted # before the file: token: still denied (comment strip is quote-aware, not just whitespace-gated)" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_quoted_hash "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
}

@test "escaped quote before the file: token: still denied (backslash doesn't flip quote state early)" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_escaped_quote "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
}

@test "escaped quote then a genuine trailing comment: allowed (no live override, not a false deny)" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_escaped_quote_then_comment "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
}

@test "file: override present on dev: allowed" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b dev >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
}

@test "downstream journal but a clean tree: allowed with a warning" {
	local project
	project="$(init_push_repo)"
	write_journal_full "$project" effected downstream adopting true
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(jq -r '.hookSpecificOutput.additionalContext // empty' <<< "$output")" == *"--exit"* ]]
}

@test "override present with no journal at all: denied (fail safe)" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
}

@test "packagesDerived false on a downstream loop: denied even with a clean tree" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_journal_full "$project" effected downstream adopting false
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"derived"* ]]
}

@test "packagesDerived absent on a downstream, non-unlinked journal (upstream-shaped or pre-existing): allowed with warning, not denied" {
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_journal "$project" effected downstream adopting
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	run bash -c "cat '${env_file}' | bash '${HOOK}'"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	[[ "$(_context "$output")" == *"effected"* ]]
}

#!/usr/bin/env bats
# __test__/pre-tool-use-dogfood-guard.bats
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

load common

HOOK="hooks/pre-tool-use/dogfood-guard.sh"

# dogfood-guard.sh runs under two entries (Bash and the GitKraken/GitHub MCP
# matcher), so run_hook needs --matcher to pick one. _guard_run picks the entry
# the host would fire for the fixture's tool_name; a tool neither entry matches
# (the non-Bash, non-MCP case) uses the Bash entry, as both carry the same env.
GUARD_MATCHER_MCP='mcp__(gk|gitkraken|GitKraken)__.*|mcp__github(-[^_].*)?__.*'
_guard_run() {
	local fixture="$1" tool
	shift
	tool=$(jq -r '.tool_name // empty' "$fixture" 2>/dev/null || true)
	case "$tool" in
		mcp__*) silk_run "$HOOK" "$fixture" --matcher "$GUARD_MATCHER_MCP" "$@" ;;
		*) silk_run "$HOOK" "$fixture" --matcher Bash "$@" ;;
	esac
}

silk_file_setup() {
	common_setup
}

_decision() {
	jq -r '(.hookSpecificOutput.permissionDecision // .permissionDecision) // empty' <<< "$1"
}

_reason() {
	jq -r '(.hookSpecificOutput.permissionDecisionReason // .permissionDecisionReason) // empty' <<< "$1"
}

_context() {
	jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$1"
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
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "dogfood dir present but no *.jsonl journals: silent allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	mkdir -p "${project}/.claude/dogfood"
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "unrelated Bash command (git status): silent no-op even with an active downstream loop" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	_guard_run "${FIXTURES_DIR}/pretooluse.bash-safe.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "unrelated MCP op (git_status): silent no-op even with an active downstream loop" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	_guard_run "${FIXTURES_DIR}/pretooluse.mcp-gitkraken-read.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "'push' appears only inside a commit message, not as the git subcommand: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-push-mention-only.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "non-Bash, non-MCP tool_name: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	_guard_run "${FIXTURES_DIR}/pretooluse.mcp-empty.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "malformed JSON input: no-op (fails open)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	silk_run_stdin "$HOOK" 'not json'
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "downstream + requested, clean tree: git push allowed with warning naming loop id, phase, and --exit" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream requested
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	local ctx; ctx="$(_context "$output")"
	[[ "$ctx" == *"effected"* ]]
	[[ "$ctx" == *"requested"* ]]
	[[ "$ctx" == *"/silk:dogfood --exit"* ]]
	done
}

@test "downstream + implementing, clean tree: git push (with global flag + force) allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream implementing
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-flags.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + handoff, clean tree: gh pr create allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream handoff
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-gh-pr-create.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + adopting, clean tree: gh pr edit allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-gh-pr-edit.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + findings, clean tree: MCP git_push allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream findings
	_guard_run "${FIXTURES_DIR}/pretooluse.mcp-gitkraken-push.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + upstream-pr, clean tree: MCP pull_request_create allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream upstream-pr
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-mcp-pull-request-create.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + handoff, clean tree: GitHub MCP create_pull_request allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream handoff
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-create-pull-request.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + adopting, clean tree: scoped GitHub MCP update_pull_request allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-update-pull-request.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + findings, clean tree: GitHub MCP push_files allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream findings
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-push-files.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + unlinked (terminal): GitHub MCP create_pull_request silent allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-create-pull-request.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "no active dogfood loop: GitHub MCP push_files silent allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-push-files.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "downstream + released, clean tree: git push allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream released
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "downstream + unlinked (terminal): silent allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "upstream role, any active phase: silent allow (upstream is not push-guarded)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected upstream upstream-pr
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "multiple journals, only the second is an active downstream loop, clean tree: allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" clean-upstream upstream implementing
	write_journal "$project" effected downstream adopting
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	local ctx; ctx="$(_context "$output")"
	[[ "$ctx" == *"effected"* ]]
	done
}

@test "corrupt tail line walks back to the previous valid (still-active) snapshot, clean tree: allowed with warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream adopting
	append_raw "$project" effected '{"at": "2026-07-16T01:00:00Z", "event": "mail-sent"'  # truncated / malformed
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

@test "corrupt tail line walks back to a now-unlinked snapshot: silent allow" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	write_journal "$project" effected downstream unlinked
	append_raw "$project" effected 'not even json'
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "journal with no valid line at all: allow (fail-open), warning logged" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	append_raw "$project" effected 'not json at all'
	append_raw "$project" effected '{"broken": '
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	run cat "$SILK_ERROR_LOG"
	[[ "$output" == *"no valid JSONL line"* ]]
	done
}

@test "empty journal file: allow (fail-open), no crash" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	local project="$CLAUDE_PROJECT_DIR"
	mkdir -p "${project}/.claude/dogfood"
	: > "${project}/.claude/dogfood/effected.jsonl"
	_guard_run "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	done
}

@test "file: override present on a non-dev branch: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
	done
}

@test "commented-out override inside an active overrides block: allowed (not a live link)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_commented_out "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	done
}

@test "trailing comment merely recalling a past file: link: allowed (no live override)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_trailing_comment_only "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	done
}

@test "real override plus a trailing comment: still denied (comment-stripping doesn't weaken real detection)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_with_trailing_comment "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
	done
}

@test "quoted # before the file: token: still denied (comment strip is quote-aware, not just whitespace-gated)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_quoted_hash "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
	done
}

@test "escaped quote before the file: token: still denied (backslash doesn't flip quote state early)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_escaped_quote "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
	done
}

@test "escaped quote then a genuine trailing comment: allowed (no live override, not a false deny)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override_escaped_quote_then_comment "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	done
}

@test "file: override present on dev: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b dev >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	done
}

@test "downstream journal but a clean tree: allowed with a warning" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	write_journal_full "$project" effected downstream adopting true
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "" ]
	[[ "$(jq -r '(.hookSpecificOutput.additionalContext // .additionalContext) // empty' <<< "$output")" == *"--exit"* ]]
	done
}

@test "override present with no journal at all: denied (fail safe)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "packagesDerived false on a downstream loop: denied even with a clean tree" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_journal_full "$project" effected downstream adopting false
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"derived"* ]]
	done
}

# --- savvy-web/systems#603 follow-up 2: the guard reasons about the PUSHED
# REF's committed content, not always the working tree -----------------------
#
# init_push_repo leaves `main` and `feature` at the same root commit. These
# helpers diverge a `feat/thing` working branch from one or two release
# branches so the refspec-resolution logic has something genuine to resolve
# against, instead of every pushed name resolving to the same commit as HEAD
# (which is what every fixture above exercises, and why they all keep passing
# unchanged -- see the header comment in dogfood-guard.sh).

# init_push_repo_with_diverging_branch [clean|linked] -- builds on
# init_push_repo: creates `release-clean` at the shared root commit (never
# touched again), optionally `release-linked` with a COMMITTED file: override
# when mode=linked, then checks out `feat/thing` and commits an unrelated
# change there so its HEAD genuinely diverges from both release branches.
init_push_repo_with_diverging_branch() {
	local mode="${1:-clean}"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -q -b release-clean
	if [ "$mode" = "linked" ]; then
		git -C "$project" checkout -q -b release-linked
		write_override "$project"
		git -C "$project" add pnpm-workspace.yaml
		git -C "$project" commit -q -m "chore: linked override"
		git -C "$project" checkout -q release-clean
	fi
	git -C "$project" checkout -q -b feat/thing
	echo "diverge" >> "${project}/README.md"
	git -C "$project" add README.md
	git -C "$project" commit -q -m "chore: diverge from release branches"
	echo "$project"
}

@test "clean ref pushed from a currently-linked tree: allowed (pushed content, not the working tree, is scanned)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-release-clean.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	done
}

@test "linked ref pushed from an otherwise-clean tree: denied (pushed content carries a committed override)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch linked)"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-linked-ref.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"install"* ]]
	[[ "$(_reason "$output")" == *"ref being pushed"* ]]
	done
}

@test "src:dst refspec form: pushed content is still what's scanned, not the working tree" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-src-dst.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	done
}

@test "force-prefixed src:dst refspec: a committed override on the source is still detected" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch linked)"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-force-prefix.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "unresolvable refspec source: falls back to the working tree (denied because the working tree carries an override)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-unresolvable-ref.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	[[ "$(_reason "$output")" == *"this tree"* ]]
	done
}

@test "bare git push with no refspec at all: unchanged working-tree behavior (denied because the working tree carries an override)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-bare.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "pushed destination is dev even though the current branch is not: allowed regardless of the working tree" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-dev-dest.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	done
}

@test "clean ref pushed while the local journal's packagesDerived is false: the tree-state deny does not apply to already-scanned-clean pushed content" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_journal_full "$project" effected downstream adopting false
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-release-clean.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	done
}

@test "packagesDerived absent on a downstream, non-unlinked journal (upstream-shaped or pre-existing): allowed with warning, not denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_journal "$project" effected downstream adopting
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push.json" "$project")"
	_guard_run "${env_file}"
	# Copilot honours no context on PreToolUse: the hook answers {} there.
	if ! silk_supports context; then assert_hook_noop; continue; fi
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" != "deny" ]
	[[ "$(_context "$output")" == *"effected"* ]]
	done
}

# --- chained commands must not leak into the refspec parse ------------------
# A `-d` belonging to a command chained after the push (gh pr create's
# --draft, ls -d) was read as `git push --delete`, and the delete
# short-circuit allowed a linked tree unscanned.

@test "linked tree, push chained with gh pr create -d: denied (the draft flag is not a push --delete)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-chained-draft-pr.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "linked tree, push followed by ; ls -d: denied" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-chained-semicolon.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "linked tree, 'push -d' inside an earlier commit message: denied (parse anchors on the real git push)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo)"
	git -C "$project" checkout -b feat/thing >/dev/null 2>&1
	write_override "$project"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-git-push-after-commit-message.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
	[ "$(_decision "$output")" = "deny" ]
	done
}

# --- one guard decision per command string ----------------------------------
# The ref-aware shortcuts (delete/dev exits, scanning the pushed ref instead
# of the tree) decide the whole invocation, so they apply only when the push
# is the command's sole guarded action. These use a pushed source that
# DIVERGES from HEAD, so the assertion depends on how the chained segment is
# handled rather than on the resolved==HEAD working-tree fallback.

_run_chained() {
	local project="$1" fixture="$2"
	local env_file
	env_file="$(envelope_with_cwd "${FIXTURES_DIR}/pretooluse.dogfood-bash-${fixture}.json" "$project")"
	_guard_run "${env_file}"
	[ "$status" -eq 0 ]
}

@test "linked tree: clean pushed ref chained with gh pr create is denied (the PR keeps its working-tree deny)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	_run_chained "$project" chained-push-clean-then-gh-pr
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "linked tree: gh pr create chained BEFORE a clean pushed ref is denied (order-independent)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	_run_chained "$project" chained-gh-pr-then-push-clean
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "linked tree: push --delete chained with gh pr create is denied (no delete short-circuit)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	_run_chained "$project" chained-push-delete-then-gh-pr
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "linked tree: a dev-destination push does not exempt a chained second push" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	_run_chained "$project" chained-push-dev-then-push
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "clean tree: a clean pushed ref does not clear a chained push of a linked ref" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch linked)"
	_run_chained "$project" chained-push-clean-then-push-linked
	[ "$(_decision "$output")" = "deny" ]
	done
}

@test "linked tree: dev-destination push chained with an unguarded command stays allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local project
	project="$(init_push_repo_with_diverging_branch clean)"
	write_override "$project"
	_run_chained "$project" chained-push-dev-then-unguarded
	[ "$(_decision "$output")" != "deny" ]
	done
}

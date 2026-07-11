#!/usr/bin/env bats
# tests/lib-match-safe-bash.bats
#
# Coverage for hooks/lib/match-safe-bash.sh, the auto-allow matcher behind the
# PreToolUse Bash hot path. Exit 0 = "safe, auto-allow"; exit 1 = "not safe,
# fall through to normal permissioning" (a prompt, NOT a denial).
#
# Focus: the hard exclusions, which are the part that errs. An over-broad
# exclusion does not endanger anything, but it silently defeats the hot path for
# ordinary commands — see savvy-web/systems#271.

load 'test_helper'

MATCH="${HOOKS_DIR}/lib/match-safe-bash.sh"

setup() {
	common_setup
}

# _safe <command> — succeeds when the matcher would auto-allow the command.
_safe() {
	bash "$MATCH" "$1"
}

# --- force-push exclusions (savvy-web/systems#271) ---------------------------
#
# The regression: `(--force|-f)` was unanchored, so `-f` substring-matched
# inside OTHER tokens. `--follow-tags` contains "-f"; so does any branch name
# containing it (`my-feature`). Both were kicked off the hot path.

@test "git push --force: excluded" {
	run _safe "git push --force"
	[ "$status" -ne 0 ]
}

@test "git push -f: excluded" {
	run _safe "git push -f"
	[ "$status" -ne 0 ]
}

@test "git push -f origin main: excluded" {
	run _safe "git push -f origin main"
	[ "$status" -ne 0 ]
}

@test "git push origin main --force: excluded" {
	run _safe "git push origin main --force"
	[ "$status" -ne 0 ]
}

# --force-with-lease is still a force-push: it overwrites remote history, just
# with a staleness check. It stays excluded deliberately.
@test "git push --force-with-lease: excluded (still a force-push)" {
	run _safe "git push --force-with-lease"
	[ "$status" -ne 0 ]
}

@test "git push --force-if-includes: excluded (still a force-push)" {
	run _safe "git push --force-if-includes"
	[ "$status" -ne 0 ]
}

@test "git push --follow-tags: auto-allowed (not a force-push)" {
	run _safe "git push --follow-tags"
	[ "$status" -eq 0 ]
}

@test "git push origin my-feature: auto-allowed (branch name contains -f)" {
	run _safe "git push origin my-feature"
	[ "$status" -eq 0 ]
}

@test "git push -u origin my-fix: auto-allowed (branch name contains -f)" {
	run _safe "git push -u origin my-fix"
	[ "$status" -eq 0 ]
}

@test "git push origin feature-x --follow-tags: auto-allowed" {
	run _safe "git push origin feature-x --follow-tags"
	[ "$status" -eq 0 ]
}

@test "plain git push: auto-allowed" {
	run _safe "git push"
	[ "$status" -eq 0 ]
}

# --- exclusions that must survive the anchoring change ----------------------

@test "git push --delete origin foo: excluded" {
	run _safe "git push --delete origin foo"
	[ "$status" -ne 0 ]
}

@test "git push --tags: excluded" {
	run _safe "git push --tags"
	[ "$status" -ne 0 ]
}

@test "git commit buried in a compound script: excluded (routes to cold path)" {
	run _safe "git status && git commit -m 'feat: x'"
	[ "$status" -ne 0 ]
}

@test "git reset --hard: excluded" {
	run _safe "git reset --hard"
	[ "$status" -ne 0 ]
}

@test "git status: auto-allowed" {
	run _safe "git status"
	[ "$status" -eq 0 ]
}

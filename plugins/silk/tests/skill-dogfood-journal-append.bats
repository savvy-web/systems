#!/usr/bin/env bats
# tests/skill-dogfood-journal-append.bats
#
# Coverage for skills/dogfood/scripts/journal-append.sh (savvy-web/systems#338):
# carry-forward of static fields, enum validation, corrupt-tail walk-back,
# --init mode (both roles), packagesDerived (#331), the owner-token warning
# (#334), the --pr repo#number shape, and the --package/--clear-packages
# mid-loop closure flags (#508).

load 'test_helper'

SCRIPT="${PLUGIN_ROOT}/skills/dogfood/scripts/journal-append.sh"

setup() {
	common_setup
	JOURNAL="${BATS_TEST_TMPDIR}/effected.jsonl"
}

seed() {
	cat > "$JOURNAL" <<-'EOF'
		{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../spencerbeggs/effected"},"packages":[{"name":"@effected/glob","override":"file:../../spencerbeggs/effected/packages/glob/dist/prod/npm/pkg"}],"packagesDerived":true,"linkType":"file","nativeRebuilds":["esbuild"],"phase":"requested","ball":"theirs","round":1,"owner":"sess-a"}
	EOF
}

@test "carries forward static fields and patches only what is passed" {
	seed
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --phase handoff --ball ours
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$JOURNAL")"
	[ "$(jq -r '.phase' <<< "$last")" = "handoff" ]
	[ "$(jq -r '.ball' <<< "$last")" = "ours" ]
	[ "$(jq -r '.role' <<< "$last")" = "downstream" ]
	[ "$(jq -r '.counterpart.id' <<< "$last")" = "effected" ]
	[ "$(jq -r '.packages[0].name' <<< "$last")" = "@effected/glob" ]
	[ "$(jq -r '.nativeRebuilds[0]' <<< "$last")" = "esbuild" ]
	[ "$(jq -r '.round' <<< "$last")" = "1" ]
}

@test "rejects an invalid phase and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --phase bogus
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects an invalid event and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event nonsense
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects an invalid ball and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --ball sideways
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects a non-boolean packages-derived and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event mail-sent --packages-derived maybe
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects a malformed --pr and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event pr-recorded --pr foo
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "accepts a well-formed --pr and records repo/number" {
	seed
	run bash "$SCRIPT" "$JOURNAL" --event pr-recorded --phase upstream-pr --pr spencerbeggs/effected#84
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$JOURNAL")"
	[ "$(jq -r '.upstream.pr.repo' <<< "$last")" = "spencerbeggs/effected" ]
	[ "$(jq -r '.upstream.pr.number' <<< "$last")" = "84" ]
}

@test "rejects a non-numeric --round with a readable error and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --round abc
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
	[[ "$output" == *"--round must be a non-negative integer"* ]]
}

@test "merges --pr into upstream.pr rather than replacing the whole upstream object" {
	cat > "$JOURNAL" <<-'EOF'
		{"at":"2026-08-01T00:00:00Z","event":"pr-recorded","role":"downstream","counterpart":{"id":"effected","path":"../../spencerbeggs/effected"},"packages":[],"packagesDerived":true,"linkType":"file","nativeRebuilds":[],"phase":"upstream-pr","ball":"theirs","round":2,"upstream":{"pr":{"repo":"spencerbeggs/effected","number":80,"url":"https://github.com/spencerbeggs/effected/pull/80"}}}
	EOF
	run bash "$SCRIPT" "$JOURNAL" --event pr-recorded --pr spencerbeggs/effected#84
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$JOURNAL")"
	[ "$(jq -r '.upstream.pr.repo' <<< "$last")" = "spencerbeggs/effected" ]
	[ "$(jq -r '.upstream.pr.number' <<< "$last")" = "84" ]
	[ "$(jq -r '.upstream.pr.url' <<< "$last")" = "https://github.com/spencerbeggs/effected/pull/80" ]
}

@test "walks back past a corrupt tail line" {
	seed
	printf 'not json at all\n' >> "$JOURNAL"
	run bash "$SCRIPT" "$JOURNAL" --event mail-received --phase adopting
	[ "$status" -eq 0 ]
	[ "$(jq -r '.counterpart.id' <<< "$(tail -n1 "$JOURNAL")")" = "effected" ]
}

@test "--init writes a loop-started line with packagesDerived false and ball theirs for downstream" {
	local fresh="${BATS_TEST_TMPDIR}/new.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role downstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected --link-type file
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$fresh")"
	[ "$(jq -r '.event' <<< "$last")" = "loop-started" ]
	[ "$(jq -r '.packagesDerived' <<< "$last")" = "false" ]
	[ "$(jq -r '.phase' <<< "$last")" = "requested" ]
	[ "$(jq -r '.ball' <<< "$last")" = "theirs" ]
}

@test "--init supports a loop-id-qualified journal filename" {
	local fresh="${BATS_TEST_TMPDIR}/effected.loop-b.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role upstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected --link-type file
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$fresh")"
	[ "$(jq -r '.counterpart.id' <<< "$last")" = "effected" ]
	[ "$(jq -r '.role' <<< "$last")" = "upstream" ]
}

@test "--init as upstream sets ball ours and omits the downstream-only fields" {
	local fresh="${BATS_TEST_TMPDIR}/upstream.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role upstream \
		--counterpart-id systems --counterpart-path ../../savvy-web/systems --link-type file
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$fresh")"
	[ "$(jq -r '.event' <<< "$last")" = "loop-started" ]
	[ "$(jq -r '.role' <<< "$last")" = "upstream" ]
	[ "$(jq -r '.ball' <<< "$last")" = "ours" ]
	[ "$(jq -r '.phase' <<< "$last")" = "requested" ]
	[ "$(jq 'has("packages")' <<< "$last")" = "false" ]
	[ "$(jq 'has("nativeRebuilds")' <<< "$last")" = "false" ]
	[ "$(jq 'has("packagesDerived")' <<< "$last")" = "false" ]
}

@test "--init --ball overrides the role-derived opening ball for downstream" {
	local fresh="${BATS_TEST_TMPDIR}/owes-request.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role downstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected \
		--link-type file --ball ours
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$fresh")"
	[ "$(jq -r '.role' <<< "$last")" = "downstream" ]
	[ "$(jq -r '.ball' <<< "$last")" = "ours" ]
	[ "$(jq -r '.phase' <<< "$last")" = "requested" ]
}

@test "--init --ball overrides the role-derived opening ball for upstream" {
	local fresh="${BATS_TEST_TMPDIR}/awaiting-request.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role upstream \
		--counterpart-id systems --counterpart-path ../../savvy-web/systems \
		--link-type file --ball theirs
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$fresh")"
	[ "$(jq -r '.role' <<< "$last")" = "upstream" ]
	[ "$(jq -r '.ball' <<< "$last")" = "theirs" ]
}

@test "--init rejects an explicitly empty --ball instead of falling back to the role default" {
	local fresh="${BATS_TEST_TMPDIR}/empty-ball.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role downstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected \
		--link-type file --ball ""
	[ "$status" -ne 0 ]
	[ ! -f "$fresh" ]
	[[ "$output" == *"invalid ball"* ]]
}

@test "a later append rejects an explicitly empty --ball and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --ball ""
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "--init rejects an invalid --ball and writes nothing" {
	local fresh="${BATS_TEST_TMPDIR}/bad-ball.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role downstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected \
		--link-type file --ball sideways
	[ "$status" -ne 0 ]
	[ ! -f "$fresh" ]
}

@test "--init records --note on the opening line" {
	local fresh="${BATS_TEST_TMPDIR}/noted.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role downstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected \
		--link-type file --note "merging publishes"
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$fresh")"
	[ "$(jq -r '.note' <<< "$last")" = "merging publishes" ]
}

@test "--init omits note when none is passed" {
	local fresh="${BATS_TEST_TMPDIR}/unnoted.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role downstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected --link-type file
	[ "$status" -eq 0 ]
	[ "$(jq 'has("note")' <<< "$(tail -n1 "$fresh")")" = "false" ]
}

@test "--init rejects a later-append-only flag instead of silently dropping it" {
	local fresh="${BATS_TEST_TMPDIR}/rejected-phase.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role downstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected \
		--link-type file --phase handoff
	[ "$status" -ne 0 ]
	[ ! -f "$fresh" ]
	[[ "$output" == *"--phase is not valid with --init"* ]]
}

@test "--init rejects an unsanctioned linkType and writes nothing" {
	local fresh="${BATS_TEST_TMPDIR}/rejected.jsonl"
	run bash "$SCRIPT" "$fresh" --init --role downstream \
		--counterpart-id effected --counterpart-path ../../spencerbeggs/effected --link-type none
	[ "$status" -ne 0 ]
	[ ! -f "$fresh" ]
}

@test "warns when the owner token differs from the last writer" {
	seed
	run bash "$SCRIPT" "$JOURNAL" --event mail-sent --owner sess-b
	[ "$status" -eq 0 ]
	[[ "$output" == *"owner"* ]]
	[ "$(jq -r '.owner' <<< "$(tail -n1 "$JOURNAL")")" = "sess-b" ]
}

@test "refuses to change role" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event correction --role upstream
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

# --- --package / --clear-packages (savvy-web/systems#508) -------------------

@test "--package replaces the closure and pairs with --packages-derived" {
	seed
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --phase adopting --ball ours \
		--package '@effected/templates=file:../x/packages/templates/dist/prod/npm/pkg' \
		--package '@effected/github=file:../x/packages/github/dist/prod/npm/pkg' \
		--packages-derived true
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$JOURNAL")"
	[ "$(jq -r '.packages | length' <<< "$last")" = "2" ]
	[ "$(jq -r '.packages[0].name' <<< "$last")" = "@effected/templates" ]
	[ "$(jq -r '.packages[0].override' <<< "$last")" = "file:../x/packages/templates/dist/prod/npm/pkg" ]
	[ "$(jq -r '.packages[1].name' <<< "$last")" = "@effected/github" ]
	[ "$(jq -r '.packagesDerived' <<< "$last")" = "true" ]
}

@test "--clear-packages empties the closure" {
	seed
	run bash "$SCRIPT" "$JOURNAL" --event unlinked --phase unlinked --clear-packages
	[ "$status" -eq 0 ]
	[ "$(jq -r '.packages | length' <<< "$(tail -n1 "$JOURNAL")")" = "0" ]
}

@test "rejects a --package without an override and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event correction --package '@effected/glob'
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects an empty --package name and appends nothing" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event correction --package '=file:../x'
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects --package together with --clear-packages" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event correction --package '@effected/glob=file:../x' --clear-packages
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects --package on an upstream journal" {
	cat > "$JOURNAL" <<-'EOF'
		{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"savvy-web-systems","path":"../../savvy-web/systems"},"linkType":"file","phase":"requested","ball":"ours","round":1}
	EOF
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event correction --package '@effected/glob=file:../x'
	[ "$status" -ne 0 ]
	[[ "$output" == *"downstream-only"* ]]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects --package alongside --init" {
	run bash "$SCRIPT" "${BATS_TEST_TMPDIR}/new.jsonl" --init --role downstream \
		--counterpart-id effected --counterpart-path ../x --link-type file \
		--package '@effected/glob=file:../x'
	[ "$status" -ne 0 ]
	[ ! -f "${BATS_TEST_TMPDIR}/new.jsonl" ]
}

@test "rejects a nonempty --package when packagesDerived carries forward false" {
	cat > "$JOURNAL" <<-'EOF'
		{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../spencerbeggs/effected"},"packages":[],"packagesDerived":false,"linkType":"file","nativeRebuilds":[],"phase":"requested","ball":"theirs","round":0}
	EOF
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --package '@effected/glob=file:../x'
	[ "$status" -ne 0 ]
	[[ "$output" == *"--packages-derived true"* ]]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "rejects a nonempty --package with an explicit --packages-derived false" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --package '@effected/glob=file:../x' --packages-derived false
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "--package needs no flag when packagesDerived already carries forward true" {
	seed
	run bash "$SCRIPT" "$JOURNAL" --event phase-change --package '@effected/glob=file:../x'
	[ "$status" -eq 0 ]
	local last
	last="$(tail -n1 "$JOURNAL")"
	[ "$(jq -r '.packages[0].name' <<< "$last")" = "@effected/glob" ]
	[ "$(jq -r '.packagesDerived' <<< "$last")" = "true" ]
}

@test "--clear-packages is exempt from the derived requirement" {
	cat > "$JOURNAL" <<-'EOF'
		{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../spencerbeggs/effected"},"packages":[],"packagesDerived":false,"linkType":"file","nativeRebuilds":[],"phase":"requested","ball":"theirs","round":0}
	EOF
	run bash "$SCRIPT" "$JOURNAL" --event unlinked --phase unlinked --clear-packages --packages-derived false
	[ "$status" -eq 0 ]
	[ "$(jq -r '.packages | length' <<< "$(tail -n1 "$JOURNAL")")" = "0" ]
}

# --- --mail-in / --mail-out validation (savvy-web/systems#546) --------------
#
# The contract (jsonl-journal.md) is a receiver-repo-relative path for
# --mail-in; validation only applies when the journal path itself sits at
# <root>/.claude/dogfood/<file>.jsonl, so these tests build a project tree
# rather than reusing the bare $JOURNAL from `seed`.

seed_project_journal() {
	PROJECT="${BATS_TEST_TMPDIR}/project"
	mkdir -p "${PROJECT}/.claude/dogfood/effected"
	PROJECT_JOURNAL="${PROJECT}/.claude/dogfood/effected.jsonl"
	cat > "$PROJECT_JOURNAL" <<-'EOF'
		{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../spencerbeggs/effected"},"packages":[],"packagesDerived":false,"linkType":"file","nativeRebuilds":[],"phase":"requested","ball":"theirs","round":0}
	EOF
}

@test "rejects a --mail-in path (with a slash) that does not resolve to an existing file" {
	seed_project_journal
	local before
	before="$(wc -l < "$PROJECT_JOURNAL")"
	run bash "$SCRIPT" "$PROJECT_JOURNAL" --event mail-received --mail-in ".claude/dogfood/effected/does-not-exist.md"
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$PROJECT_JOURNAL")" -eq "$before" ]
	[[ "$output" == *"does not resolve to an existing file"* ]]
}

@test "normalizes a bare --mail-in filename that exists in the counterpart mailbox" {
	seed_project_journal
	touch "${PROJECT}/.claude/dogfood/effected/2026-08-22-release-catalog-0.6.0.md"
	run bash "$SCRIPT" "$PROJECT_JOURNAL" --event mail-received --mail-in "2026-08-22-release-catalog-0.6.0.md"
	[ "$status" -eq 0 ]
	[[ "$output" == *"normalizing bare --mail-in"* ]]
	[ "$(jq -r '.lastMail.in' <<< "$(tail -n1 "$PROJECT_JOURNAL")")" = ".claude/dogfood/effected/2026-08-22-release-catalog-0.6.0.md" ]
}

@test "rejects a bare --mail-in filename that does not exist anywhere" {
	seed_project_journal
	local before
	before="$(wc -l < "$PROJECT_JOURNAL")"
	run bash "$SCRIPT" "$PROJECT_JOURNAL" --event mail-received --mail-in "typo-does-not-exist.md"
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$PROJECT_JOURNAL")" -eq "$before" ]
}

@test "rejecting an invalid --mail-in leaves the journal byte-identical" {
	seed_project_journal
	local before_sum
	before_sum="$(shasum "$PROJECT_JOURNAL")"
	run bash "$SCRIPT" "$PROJECT_JOURNAL" --event mail-received --mail-in "typo-does-not-exist.md"
	[ "$status" -ne 0 ]
	[ "$(shasum "$PROJECT_JOURNAL")" = "$before_sum" ]
}

@test "accepts a --mail-in already in receiver-repo-relative form" {
	seed_project_journal
	touch "${PROJECT}/.claude/dogfood/effected/2026-08-22-release-catalog-0.6.0.md"
	run bash "$SCRIPT" "$PROJECT_JOURNAL" --event mail-received --mail-in ".claude/dogfood/effected/2026-08-22-release-catalog-0.6.0.md"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.lastMail.in' <<< "$(tail -n1 "$PROJECT_JOURNAL")")" = ".claude/dogfood/effected/2026-08-22-release-catalog-0.6.0.md" ]
}

@test "--mail-in validation is skipped for a journal outside the .claude/dogfood layout (back-compat)" {
	seed
	run bash "$SCRIPT" "$JOURNAL" --event mail-received --mail-in "anything-goes.md"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.lastMail.in' <<< "$(tail -n1 "$JOURNAL")")" = "anything-goes.md" ]
}

@test "rejects a bare --mail-out with no path separator" {
	seed
	local before
	before="$(wc -l < "$JOURNAL")"
	run bash "$SCRIPT" "$JOURNAL" --event mail-sent --mail-out "handoff.md"
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$JOURNAL")" -eq "$before" ]
}

@test "accepts a --mail-out counterpart-relative path without requiring it to exist" {
	seed
	run bash "$SCRIPT" "$JOURNAL" --event mail-sent \
		--mail-out "../../spencerbeggs/effected/.claude/dogfood/savvy-web-systems/findings.md"
	[ "$status" -eq 0 ]
	[ "$(jq -r '.lastMail.out' <<< "$(tail -n1 "$JOURNAL")")" = "../../spencerbeggs/effected/.claude/dogfood/savvy-web-systems/findings.md" ]
}

@test "rejects a --mail-in that escapes the repo via .. traversal, even though the file exists" {
	seed_project_journal
	touch "${BATS_TEST_TMPDIR}/outside.md"
	local before
	before="$(wc -l < "$PROJECT_JOURNAL")"
	run bash "$SCRIPT" "$PROJECT_JOURNAL" --event mail-received --mail-in "../outside.md"
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$PROJECT_JOURNAL")" -eq "$before" ]
	[[ "$output" == *"resolves outside the repo root"* ]]
}

@test "rejects a --mail-in reached through a symlinked directory pointing outside the repo" {
	seed_project_journal
	mkdir -p "${BATS_TEST_TMPDIR}/elsewhere"
	touch "${BATS_TEST_TMPDIR}/elsewhere/mail.md"
	ln -s "${BATS_TEST_TMPDIR}/elsewhere" "${PROJECT}/.claude/dogfood/effected/linked"
	local before
	before="$(wc -l < "$PROJECT_JOURNAL")"
	run bash "$SCRIPT" "$PROJECT_JOURNAL" --event mail-received --mail-in ".claude/dogfood/effected/linked/mail.md"
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$PROJECT_JOURNAL")" -eq "$before" ]
	[[ "$output" == *"resolves outside the repo root"* ]]
}

@test "rejects a --mail-in that is a symlinked file pointing outside the repo" {
	seed_project_journal
	touch "${BATS_TEST_TMPDIR}/outside.md"
	ln -s "${BATS_TEST_TMPDIR}/outside.md" "${PROJECT}/.claude/dogfood/effected/2026-09-23-link.md"
	local before
	before="$(wc -l < "$PROJECT_JOURNAL")"
	run bash "$SCRIPT" "$PROJECT_JOURNAL" --event mail-received --mail-in ".claude/dogfood/effected/2026-09-23-link.md"
	[ "$status" -ne 0 ]
	[ "$(wc -l < "$PROJECT_JOURNAL")" -eq "$before" ]
	[[ "$output" == *"is a symlink"* ]]
}

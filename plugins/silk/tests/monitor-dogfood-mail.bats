#!/usr/bin/env bats
# tests/monitor-dogfood-mail.bats
#
# Coverage for monitors/dogfood-mail.mjs: the filesystem-only half of the
# dogfood mailbox protocol (skills/dogfood/SKILL.md). Two things watched:
#   1. inbound mailboxes ".claude/dogfood/<id>/*.md" newer than the loop's
#      journaled lastMail.in, not yet notified;
#   2. journals ".claude/dogfood/*.jsonl" -- a new tail line whose `ball` is
#      "ours".
# No network is ever touched by this script -- these tests assert that by
# construction (fixture trees are local files only).

load 'test_helper'

MONITOR="${PLUGIN_ROOT}/monitors/dogfood-mail.mjs"

setup() {
	common_setup
}

# write_journal_line <project> <loop-id> <json-line> -- append a raw JSONL
# line to .claude/dogfood/<loop-id>.jsonl.
write_journal_line() {
	local project="$1" loop_id="$2" line="$3"
	local dir="${project}/.claude/dogfood"
	mkdir -p "$dir"
	printf '%s\n' "$line" >> "${dir}/${loop_id}.jsonl"
}

# write_mail <project> <loop-id> <filename> <kind> <round> <heading> -- write
# a mail file into the inbound mailbox for <loop-id>.
write_mail() {
	local project="$1" loop_id="$2" filename="$3" kind="$4" round="$5" heading="$6"
	local dir="${project}/.claude/dogfood/${loop_id}"
	mkdir -p "$dir"
	cat > "${dir}/${filename}" <<-EOF
	---
	from: ${loop_id}
	to: savvy-web-systems
	kind: ${kind}
	round: ${round}
	---

	# ${heading}

	Body text.
	EOF
}

@test "no .claude/dogfood directory: no output, no crash" {
	make_project >/dev/null
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "journal present, ball is theirs: no turn alert" {
	make_project >/dev/null
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-sent","role":"downstream","phase":"requested","ball":"theirs","round":1}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "terminal unlinked snapshot with ball ours: no turn alert (issue #314)" {
	make_project >/dev/null
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-sent","role":"downstream","phase":"unlinked","ball":"ours","round":3}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "journal present, ball is ours: turn alert names loop and phase" {
	make_project >/dev/null
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","phase":"adopting","ball":"ours","round":2}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood: ball is ours in loop "effected" (phase: adopting)'* ]]
}

@test "corrupt tail line: walks back to the previous valid snapshot" {
	make_project >/dev/null
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","phase":"adopting","ball":"ours","round":2}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected '{"broken":'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood: ball is ours in loop "effected" (phase: adopting)'* ]]
}

@test "journal with no valid line at all: no turn alert, no crash" {
	make_project >/dev/null
	write_journal_line "$CLAUDE_PROJECT_DIR" effected 'not json'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "new mail newer than lastMail.in: surfaced with kind, round, and heading" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-16-handoff-round-2.md" handoff 2 "Round 2 handoff: npm kit changes"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","phase":"handoff","ball":"ours","round":2,"lastMail":{"in":".claude/dogfood/effected/2026-07-15-request-round-1.md"}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood mail from effected: handoff (round 2) — Round 2 handoff: npm kit changes'* ]]
}

@test "mail file already recorded as lastMail.in: not re-surfaced" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-16-handoff-round-2.md" handoff 2 "Round 2 handoff"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","phase":"adopting","ball":"ours","round":2,"lastMail":{"in":".claude/dogfood/effected/2026-07-16-handoff-round-2.md"}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" != *"dogfood mail from"* ]]
	# still reports the turn alert -- only the mail line is suppressed
	[[ "$output" == *'dogfood: ball is ours in loop "effected"'* ]]
}

@test "multiple loops: independent turn alerts and mail" {
	make_project >/dev/null
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","phase":"adopting","ball":"ours","round":2}'
	write_journal_line "$CLAUDE_PROJECT_DIR" other-repo \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-sent","role":"upstream","phase":"upstream-pr","ball":"theirs","round":1}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'"effected"'* ]]
	[[ "$output" != *'"other-repo"'* ]]
}

@test "quiet second tick: no repeated notifications for an unchanged snapshot or already-notified mail" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-16-handoff-round-2.md" handoff 2 "Round 2 handoff"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","phase":"handoff","ball":"ours","round":2,"lastMail":{"in":".claude/dogfood/effected/2026-07-15-request-round-1.md"}}'

	local harness="${BATS_TEST_TMPDIR}/double-tick.mjs"
	cat > "$harness" <<-EOF
	import { scan, diagnose } from "${MONITOR}";
	let prev = { journals: new Map(), mailboxes: new Map() };
	const c1 = await scan();
	const r1 = diagnose(c1, prev);
	prev = r1.next;
	console.log("TICK1:" + r1.lines.length);
	const c2 = await scan();
	const r2 = diagnose(c2, prev);
	console.log("TICK2:" + r2.lines.length);
	EOF

	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$harness"
	[ "$status" -eq 0 ]
	[[ "$output" == *"TICK1:2"* ]]
	[[ "$output" == *"TICK2:0"* ]]
}

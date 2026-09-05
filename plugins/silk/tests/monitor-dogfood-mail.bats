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

# write_mail <project> <loop-id> <filename> <kind> <round> <heading> [loop] --
# write a mail file into the inbound mailbox for <loop-id>.
write_mail() {
	local project="$1" loop_id="$2" filename="$3" kind="$4" round="$5" heading="$6" loop="${7:-}"
	local dir="${project}/.claude/dogfood/${loop_id}"
	mkdir -p "$dir"
	cat > "${dir}/${filename}" <<-EOF
	---
	from: ${loop_id}
	to: savvy-web-systems
	kind: ${kind}
	round: ${round}
	${loop:+loop: ${loop}}
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

# --- issue #339: turn-flips caused by the session's own journal appends ------
# The monitor must not re-announce a turn to the very session that already
# learned about the triggering mail from an earlier mail event. A flip citing
# mail the monitor has not already surfaced (a genuine inbound turn) must
# still fire.

@test "own-append turn-flip citing already-surfaced mail: no turn alert (issue #339)" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-20-handoff-round-1.md" handoff 1 "Round 1 handoff"

	local harness="${BATS_TEST_TMPDIR}/self-echo.mjs"
	cat > "$harness" <<-EOF
	import { appendFileSync } from "node:fs";
	import { join } from "node:path";
	import { scan, diagnose } from "${MONITOR}";

	const root = process.env.CLAUDE_PROJECT_DIR;
	let prev = { journals: new Map(), mailboxes: new Map() };

	const c1 = await scan();
	const r1 = diagnose(c1, prev);
	prev = r1.next;
	console.log("TICK1:" + r1.lines.length);

	// The session reads the mail and appends its own turn-flip snapshot
	// citing it as lastMail.in -- the self-echo this fix suppresses.
	appendFileSync(
		join(root, ".claude", "dogfood", "effected.jsonl"),
		JSON.stringify({
			at: "2026-07-20T01:00:00Z",
			event: "mail-received",
			role: "downstream",
			phase: "adopting",
			ball: "ours",
			round: 1,
			lastMail: { in: ".claude/dogfood/effected/2026-07-20-handoff-round-1.md" },
		}) + "\n",
	);

	const c2 = await scan();
	const r2 = diagnose(c2, prev);
	console.log("TICK2:" + r2.lines.length);
	EOF

	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$harness"
	[ "$status" -eq 0 ]
	[[ "$output" == *"TICK1:1"* ]]
	[[ "$output" == *"TICK2:0"* ]]
}

@test "inbound flip citing not-yet-surfaced mail: turn alert still emits (issue #339)" {
	make_project >/dev/null
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-20T00:00:00Z","event":"loop-started","role":"downstream","phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'

	local harness="${BATS_TEST_TMPDIR}/genuine-flip.mjs"
	cat > "$harness" <<-EOF
	import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
	import { join } from "node:path";
	import { scan, diagnose } from "${MONITOR}";

	const root = process.env.CLAUDE_PROJECT_DIR;
	let prev = { journals: new Map(), mailboxes: new Map() };

	const c1 = await scan();
	const r1 = diagnose(c1, prev);
	prev = r1.next;
	console.log("TICK1:" + r1.lines.length);

	// A brand new mail file this monitor has never surfaced, and the journal
	// already reflecting it in the same tick -- not a self-echo of anything
	// this monitor already told the session about.
	mkdirSync(join(root, ".claude", "dogfood", "effected"), { recursive: true });
	writeFileSync(
		join(root, ".claude", "dogfood", "effected", "2026-07-21-request-round-2.md"),
		"---\nfrom: effected\nto: savvy-web-systems\nkind: request\nround: 2\n---\n\n# Round 2 request\n\nBody text.\n",
	);
	appendFileSync(
		join(root, ".claude", "dogfood", "effected.jsonl"),
		JSON.stringify({
			at: "2026-07-21T00:00:00Z",
			event: "mail-received",
			role: "downstream",
			phase: "adopting",
			ball: "ours",
			round: 2,
			lastMail: { in: ".claude/dogfood/effected/2026-07-21-request-round-2.md" },
		}) + "\n",
	);

	const c2 = await scan();
	const r2 = diagnose(c2, prev);
	console.log("TICK2:" + r2.lines.length);
	for (const line of r2.lines) console.log(line);
	EOF

	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$harness"
	[ "$status" -eq 0 ]
	[[ "$output" == *"TICK1:0"* ]]
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

@test "same counterpart with two loop journals: turn alert is per loop id" {
	make_project >/dev/null
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-a \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","phase":"adopting","ball":"ours","round":2}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-sent","role":"upstream","phase":"upstream-pr","ball":"theirs","round":1}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'"effected.loop-a"'* ]]
	[[ "$output" != *'"effected.loop-b"'* ]]
}

@test "mail loop frontmatter routes same-counterpart mail to the matching loop journal" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-16-findings-loop-b.md" findings 2 "Loop B findings" loop-b
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-a \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"adopting","ball":"ours","round":2,"lastMail":{"in":".claude/dogfood/effected/2026-07-16-findings-loop-b.md"}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"findings","ball":"theirs","round":2,"lastMail":{"in":".claude/dogfood/effected/2026-07-15-handoff-loop-b.md"}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood mail from effected (loop effected.loop-b): findings (round 2) — Loop B findings'* ]]
}

@test "loop attribution handles counterpart ids containing dots" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" savvy.web "2026-07-16-findings-loop-b.md" findings 2 "Loop B findings" loop-b
	write_journal_line "$CLAUDE_PROJECT_DIR" savvy.web.loop-a \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"downstream","counterpart":{"id":"savvy.web","path":"../../x"},"phase":"adopting","ball":"ours","round":2,"lastMail":{"in":".claude/dogfood/savvy.web/2026-07-16-findings-loop-b.md"}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" savvy.web.loop-b \
		'{"at":"2026-07-16T00:00:00Z","event":"mail-received","role":"upstream","counterpart":{"id":"savvy.web","path":"../../x"},"phase":"findings","ball":"theirs","round":2,"lastMail":{"in":".claude/dogfood/savvy.web/2026-07-15-handoff-loop-b.md"}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood mail from savvy.web (loop savvy.web.loop-b): findings (round 2) — Loop B findings'* ]]
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

# --- issue #344: an unresolvable lastMail.in must not replay the mailbox ------
# Both cases previously fell back to a watermark of 0, so every file in the
# mailbox counted as newer and a reopened loop replayed the whole archive of the
# preceding collaboration. The fallback is now the current loop's `loop-started`
# time, so mail predating this collaboration is never new to it.

@test "reopened loop with lastMail.in null: prior collaboration's mail is not replayed (issue #344)" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-20-handoff-round-4.md" handoff 4 "Old handoff from the closed loop"
	touch -t 202607200000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-07-20-handoff-round-4.md"
	# previous collaboration closed, then a fresh one opened with no mail yet
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-20T12:00:00Z","event":"unlinked","role":"downstream","phase":"unlinked","ball":"ours","round":4,"lastMail":{"in":".claude/dogfood/effected/2026-07-20-handoff-round-4.md"}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-24T23:00:00Z","event":"loop-started","role":"downstream","phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" != *"dogfood mail from"* ]]
}

@test "reopened loop with lastMail.in null: mail arriving after loop-started IS surfaced (issue #344)" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-20-handoff-round-4.md" handoff 4 "Old handoff from the closed loop"
	touch -t 202607200000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-07-20-handoff-round-4.md"
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-25-request-round-1.md" request 1 "Fresh request in the new loop"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-24T23:00:00Z","event":"loop-started","role":"downstream","phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood mail from effected: request (round 1) — Fresh request in the new loop'* ]]
	[[ "$output" != *"Old handoff from the closed loop"* ]]
}

@test "lastMail.in naming a nonexistent file: falls back to loop-started, not to everything (issue #344)" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-20-handoff-round-4.md" handoff 4 "Old handoff from the closed loop"
	touch -t 202607200000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-07-20-handoff-round-4.md"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-24T23:00:00Z","event":"loop-started","role":"downstream","phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	# a hand-authored append citing a filename that does not exist
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-25T01:00:00Z","event":"mail-received","role":"downstream","phase":"handoff","ball":"ours","round":1,"lastMail":{"in":".claude/dogfood/effected/typo-does-not-exist.md"}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" != *"Old handoff from the closed loop"* ]]
}

@test "journal with no loop-started line: unresolvable pointer still degrades to surfacing mail" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-25-request-round-1.md" request 1 "Request with no loop-started anywhere"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-07-25T01:00:00Z","event":"mail-received","role":"downstream","phase":"handoff","ball":"ours","round":1,"lastMail":{"in":null}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood mail from effected: request (round 1) — Request with no loop-started anywhere'* ]]
}

# --- multi-loop mailboxes: unattributed mail still gets a watermark ----------
# A counterpart hosting two loops has no journal named for the counterpart
# itself, so mail without `loop:` frontmatter pins to no single journal. That
# path must not fall back to a watermark of 0 -- doing so replays the whole
# archive of the earlier collaboration the first tick after the second loop
# opens, which is #344 reopened through a new door. Every mail file written
# before loop-scoped journals existed lacks `loop:`, so this is the common case,
# not a corner one.

@test "multi-loop mailbox: unattributed archived mail is not replayed" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-01-01-handoff-round-9.md" handoff 9 "Archived mail from a closed loop"
	touch -t 202601010000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-01-01-handoff-round-9.md"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-a \
		'{"at":"2026-07-16T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-07-17T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" != *"dogfood mail from"* ]]
}

@test "multi-loop mailbox: unattributed mail newer than the earliest loop IS surfaced" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-01-01-handoff-round-9.md" handoff 9 "Archived mail from a closed loop"
	touch -t 202601010000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-01-01-handoff-round-9.md"
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-18-request-round-1.md" request 1 "Unrouted but genuinely new"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-a \
		'{"at":"2026-07-16T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-07-17T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood mail from effected: request (round 1) — Unrouted but genuinely new'* ]]
	[[ "$output" != *"Archived mail from a closed loop"* ]]
}

@test "multi-loop mailbox: unattributed mail suppresses a later self-echoing turn flip (issue #339)" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-18-request-round-1.md" request 1 "Unrouted but genuinely new"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-a \
		'{"at":"2026-07-16T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-07-17T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'

	local harness="${BATS_TEST_TMPDIR}/multi-loop-echo.mjs"
	cat > "$harness" <<-EOF
	import { appendFileSync } from "node:fs";
	import { join } from "node:path";
	import { scan, diagnose } from "${MONITOR}";
	const root = process.env.CLAUDE_PROJECT_DIR;
	let prev = { journals: new Map(), mailboxes: new Map() };
	const r1 = diagnose(await scan(), prev);
	prev = r1.next;
	for (const line of r1.lines) console.log("TICK1:" + line);

	// loop-a's session records the mail the monitor just surfaced. The flip to
	// "ours" cites a file already announced, so it carries nothing new.
	appendFileSync(
		join(root, ".claude", "dogfood", "effected.loop-a.jsonl"),
		JSON.stringify({
			at: "2026-07-18T01:00:00Z",
			event: "mail-received",
			role: "downstream",
			counterpart: { id: "effected", path: "../../x" },
			phase: "adopting",
			ball: "ours",
			round: 1,
			lastMail: { in: ".claude/dogfood/effected/2026-07-18-request-round-1.md" },
		}) + "\n",
	);

	const r2 = diagnose(await scan(), prev);
	console.log("TICK2:" + r2.lines.length);
	for (const line of r2.lines) console.log("TICK2LINE:" + line);
	EOF

	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$harness"
	[ "$status" -eq 0 ]
	[[ "$output" == *"TICK1:dogfood mail from effected: request (round 1) — Unrouted but genuinely new"* ]]
	[[ "$output" == *"TICK2:0"* ]]
}

# --- mixed bare + loop-scoped journals: the migration shape -------------------
# A counterpart that keeps its bare `<id>.jsonl` and opens `<id>.<loop>.jsonl`
# beside it has a non-null defaultJournal, so an earlier fix that fanned out only
# when NO default existed still narrowed unpinned mail to the bare journal. Every
# existing loop migrates through exactly this shape, so it is the common path.

@test "bare journal beside a loop-scoped one: unpinned mail suppresses loop-b's self-echo (issue #339)" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-09-01-request-round-1.md" request 1 "Genuinely new inbound"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-08-02T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'

	local harness="${BATS_TEST_TMPDIR}/mixed-echo.mjs"
	cat > "$harness" <<-EOF
	import { appendFileSync } from "node:fs";
	import { join } from "node:path";
	import { scan, diagnose } from "${MONITOR}";
	const root = process.env.CLAUDE_PROJECT_DIR;
	let prev = { journals: new Map(), mailboxes: new Map() };
	const r1 = diagnose(await scan(), prev);
	prev = r1.next;
	for (const line of r1.lines) console.log("TICK1:" + line);
	console.log("KEYS:" + [...prev.mailboxes.keys()].sort().join(","));

	// loop-b's session records the mail the monitor just surfaced.
	appendFileSync(
		join(root, ".claude", "dogfood", "effected.loop-b.jsonl"),
		JSON.stringify({
			at: "2026-09-02T00:00:00Z",
			event: "mail-received",
			role: "upstream",
			counterpart: { id: "effected", path: "../../x" },
			phase: "adopting",
			ball: "ours",
			round: 1,
			lastMail: { in: ".claude/dogfood/effected/2026-09-01-request-round-1.md" },
		}) + "\n",
	);

	const r2 = diagnose(await scan(), prev);
	console.log("TICK2:" + r2.lines.length);
	for (const line of r2.lines) console.log("TICK2LINE:" + line);
	EOF

	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$harness"
	[ "$status" -eq 0 ]
	[[ "$output" == *"TICK1:dogfood mail from effected: request (round 1) — Genuinely new inbound"* ]]
	[[ "$output" == *"KEYS:effected,effected.loop-b"* ]]
	[[ "$output" == *"TICK2:0"* ]]
}

@test "bare journal beside a loop-scoped one: watermark is the earliest loop, not the default journal's" {
	make_project >/dev/null
	# The bare journal opened LAST, so judging unpinned mail by it alone would
	# silence a file that is genuinely new to the older loop-b.
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-07-15-request-round-1.md" request 1 "New to loop-b, older than the bare loop"
	touch -t 202607150000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-07-15-request-round-1.md"
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-01-01-handoff-round-9.md" handoff 9 "Archived mail predating every loop"
	touch -t 202601010000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-01-01-handoff-round-9.md"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-07-01T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" == *'dogfood mail from effected: request (round 1) — New to loop-b, older than the bare loop'* ]]
	[[ "$output" != *"Archived mail predating every loop"* ]]
}

@test "loop: naming a journal that does not exist is not pinned to the default journal" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-09-01-findings-typo.md" findings 2 "Names a loop that is not there" loop-zzz
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-08-02T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'

	local harness="${BATS_TEST_TMPDIR}/unmatched-loop.mjs"
	cat > "$harness" <<-EOF
	import { scan, diagnose } from "${MONITOR}";
	const r = diagnose(await scan(), { journals: new Map(), mailboxes: new Map() });
	for (const line of r.lines) console.log("LINE:" + line);
	console.log("KEYS:" + [...r.next.mailboxes.keys()].sort().join(","));
	EOF

	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$harness"
	[ "$status" -eq 0 ]
	[[ "$output" == *"LINE:dogfood mail from effected: findings (round 2) — Names a loop that is not there"* ]]
	# unmatched loop: pins nothing, so it is recorded against every candidate
	[[ "$output" == *"KEYS:effected,effected.loop-b"* ]]
}

# --- closed loops must not lower the counterpart's watermark ------------------
# `--exit` keeps the journal deliberately (no delete, no archive step), so a
# terminated loop-scoped journal outlives its collaboration and sits beside the
# live one. Nothing can be new to a loop that is over, so it must not contribute
# a watermark -- fanning out over it drags the bar back to its `loop-started`
# and replays both loops' archives (#344).

@test "closed loop beside a live one: its watermark does not replay the archive (issue #344)" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-03-01-handoff-round-9.md" handoff 9 "Archived mail from the closed loop"
	touch -t 202603010000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-03-01-handoff-round-9.md"
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-08-20-status-round-4.md" status 4 "Last mail the live loop processed"
	touch -t 202608200000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-08-20-status-round-4.md"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-08-20T00:00:00Z","event":"mail-received","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"adopting","ball":"theirs","round":4,"lastMail":{"in":".claude/dogfood/effected/2026-08-20-status-round-4.md"}}'
	# a loop that opened earlier and has since been --exit'd
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-01-01T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-02-01T00:00:00Z","event":"unlinked","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"unlinked","ball":"ours","round":3,"lastMail":{"in":null,"out":null}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" != *"dogfood mail from"* ]]
}

@test "every loop for a counterpart closed: the mailbox is quiescent, not replayed" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-03-01-handoff-round-9.md" handoff 9 "Archived mail from a closed loop"
	touch -t 202603010000 "${CLAUDE_PROJECT_DIR}/.claude/dogfood/effected/2026-03-01-handoff-round-9.md"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-08-25T00:00:00Z","event":"unlinked","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"unlinked","ball":"ours","round":4,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-01-01T00:00:00Z","event":"loop-started","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'
	write_journal_line "$CLAUDE_PROJECT_DIR" effected.loop-b \
		'{"at":"2026-02-01T00:00:00Z","event":"unlinked","role":"upstream","counterpart":{"id":"effected","path":"../../x"},"phase":"unlinked","ball":"ours","round":3,"lastMail":{"in":null,"out":null}}'
	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$MONITOR" --once
	[ "$status" -eq 0 ]
	[[ "$output" != *"dogfood mail from"* ]]
}

# --- notified state back-fills onto a journal that appears later --------------
# `--init` opening a second loop for mail the monitor just announced is the
# sequence this feature exists to enable. The new journal's notified set starts
# empty, and the re-announce is correctly suppressed, so without a back-fill the
# new loop's first `ball: ours` append fires a spurious turn alert (#339).

@test "journal created after mail was surfaced: back-filled, so its first flip is silent (issue #339)" {
	make_project >/dev/null
	write_mail "$CLAUDE_PROJECT_DIR" effected "2026-09-01-request-round-1.md" request 1 "New inbound"
	write_journal_line "$CLAUDE_PROJECT_DIR" effected \
		'{"at":"2026-08-01T00:00:00Z","event":"loop-started","role":"downstream","counterpart":{"id":"effected","path":"../../x"},"phase":"requested","ball":"theirs","round":1,"lastMail":{"in":null,"out":null}}'

	local harness="${BATS_TEST_TMPDIR}/backfill.mjs"
	cat > "$harness" <<-EOF
	import { writeFileSync, appendFileSync } from "node:fs";
	import { join } from "node:path";
	import { scan, diagnose } from "${MONITOR}";
	const root = process.env.CLAUDE_PROJECT_DIR;
	const loopB = join(root, ".claude", "dogfood", "effected.loop-b.jsonl");
	const counterpart = { id: "effected", path: "../../x" };
	let prev = { journals: new Map(), mailboxes: new Map() };

	const r1 = diagnose(await scan(), prev);
	prev = r1.next;
	for (const line of r1.lines) console.log("TICK1:" + line);

	// --init opens a second loop AFTER the mail was already surfaced
	writeFileSync(
		loopB,
		JSON.stringify({
			at: "2026-08-02T00:00:00Z",
			event: "loop-started",
			role: "upstream",
			counterpart,
			phase: "requested",
			ball: "theirs",
			round: 1,
			lastMail: { in: null, out: null },
		}) + "\n",
	);
	const r2 = diagnose(await scan(), prev);
	prev = r2.next;
	console.log("TICK2:" + r2.lines.length);
	console.log("LOOPB:" + [...(prev.mailboxes.get("effected.loop-b")?.notified ?? [])].join(","));

	appendFileSync(
		loopB,
		JSON.stringify({
			at: "2026-09-02T00:00:00Z",
			event: "mail-received",
			role: "upstream",
			counterpart,
			phase: "adopting",
			ball: "ours",
			round: 1,
			lastMail: { in: ".claude/dogfood/effected/2026-09-01-request-round-1.md" },
		}) + "\n",
	);
	const r3 = diagnose(await scan(), prev);
	console.log("TICK3:" + r3.lines.length);
	for (const line of r3.lines) console.log("TICK3LINE:" + line);
	EOF

	run env CLAUDE_PROJECT_DIR="$CLAUDE_PROJECT_DIR" node "$harness"
	[ "$status" -eq 0 ]
	[[ "$output" == *"TICK1:dogfood mail from effected: request (round 1) — New inbound"* ]]
	[[ "$output" == *"TICK2:0"* ]]
	[[ "$output" == *"LOOPB:2026-09-01-request-round-1.md"* ]]
	[[ "$output" == *"TICK3:0"* ]]
}

#!/usr/bin/env node
// Background monitor: the fs-only half of the dogfood mailbox protocol (see
// skills/dogfood/SKILL.md and docs/superpowers/specs/
// 2026-07-16-dogfood-mailbox-skill-design.md). Watches two LOCAL things only
// -- no network, ever, per the spec's monitor rule:
//
//   1. Inbound mailboxes ".claude/dogfood/<counterpart-id>/*.md" -- files
//      newer than the loop's journaled `lastMail.in`, not yet notified. A
//      mailbox can carry multiple loops with the same counterpart; frontmatter
//      `loop:` disambiguates to ".claude/dogfood/<counterpart-id>.<loop>.jsonl".
//   2. Journals ".claude/dogfood/*.jsonl" -- a new tail line (JSONL
//      snapshot-lines; current state is the last VALID line) whose `ball` is
//      "ours".
//
// Sibling of watch-issues.mjs: same self-scheduling poll loop, same
// `diagnose(current, prev)` pure-function shape so it's importable by tests
// without starting the interval, same `--once` single-shot mode.
import { globSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const DOGFOOD_DIR = join(ROOT, ".claude", "dogfood");
const POLL_MS = 2000;

// --- parsing --------------------------------------------------------------

/**
 * Return the last VALID line of a JSONL journal (walking bottom-up, per the
 * journal's corrupt-tail-self-heals contract), parsed to an object, or null
 * if the file is empty / every line is malformed.
 */
function lastValidJsonlLine(text) {
	const lines = text.split("\n");
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (!line) continue;
		try {
			const parsed = JSON.parse(line);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed;
			}
		} catch {
			// unparseable tail line -- walk back one line, same posture as
			// dogfood-guard.sh
		}
	}
	return null;
}

/**
 * Timestamp (ms) of the CURRENT collaboration's opening line -- the `at` of the
 * last `loop-started` snapshot in the journal.
 *
 * A journal outlives any one collaboration: a reopened loop appends a fresh
 * `loop-started` after the previous terminal `unlinked`, so the LAST one marks
 * where the current loop began and everything above it belongs to a closed
 * collaboration. Used as the fallback watermark for new-mail detection when the
 * journal's `lastMail.in` pointer cannot be resolved (issue #344), so already
 * processed mail from a previous loop is never re-announced as new.
 *
 * Returns null when no `loop-started` line is present or its `at` is unparseable.
 */
function loopStartedAtMs(text) {
	const lines = text.split("\n");
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (!line) continue;
		try {
			const parsed = JSON.parse(line);
			if (parsed?.event === "loop-started" && typeof parsed.at === "string") {
				const ms = Date.parse(parsed.at);
				return Number.isNaN(ms) ? null : ms;
			}
		} catch {
			// malformed line -- walk back, same posture as lastValidJsonlLine
		}
	}
	return null;
}

/** Split light YAML frontmatter (`---\nkey: value\n---`) off a mail file. */
function parseMailFile(text) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
	const frontmatter = {};
	let body = text;
	if (match) {
		body = match[2];
		for (const line of match[1].split("\n")) {
			const kv = /^([A-Za-z-]+):\s*(.*)$/.exec(line.trim());
			if (kv) frontmatter[kv[1]] = kv[2].trim();
		}
	}
	const headingMatch = /^#\s+(.+)$/m.exec(body);
	return {
		kind: frontmatter.kind ?? "?",
		loop: frontmatter.loop ?? "",
		round: frontmatter.round ?? "?",
		heading: headingMatch ? headingMatch[1].trim() : "(no heading)",
	};
}

// --- scanning ---------------------------------------------------------------

async function scanJournals() {
	const files = globSync("*.jsonl", { cwd: DOGFOOD_DIR });
	const journals = [];
	for (const rel of files) {
		const path = join(DOGFOOD_DIR, rel);
		const id = rel.slice(0, -".jsonl".length);
		try {
			const text = await readFile(path, "utf8");
			const snapshot = lastValidJsonlLine(text);
			const counterpartFromSnapshot =
				snapshot?.counterpart && typeof snapshot.counterpart === "object" && typeof snapshot.counterpart.id === "string"
					? snapshot.counterpart.id
					: null;
			const counterpartId = counterpartFromSnapshot ?? id;
			const loopId =
				id === counterpartId
					? counterpartId
					: id.startsWith(`${counterpartId}.`)
						? id.slice(counterpartId.length + 1)
						: id;
			journals.push({
				id,
				path,
				counterpartId,
				loopId,
				snapshot,
				loopStartedAtMs: loopStartedAtMs(text),
			});
		} catch {
			// unreadable journal -- skip, same fail-open posture as the hook
		}
	}
	return journals;
}

async function scanMailboxes() {
	const dirs = globSync("*/", { cwd: DOGFOOD_DIR });
	const mailboxes = [];
	for (const rel of dirs) {
		const id = rel.replace(/\/$/, "");
		const dirPath = join(DOGFOOD_DIR, rel);
		const mdFiles = globSync("*.md", { cwd: dirPath });
		const files = [];
		for (const name of mdFiles) {
			const path = join(dirPath, name);
			try {
				const { mtimeMs } = statSync(path);
				const text = await readFile(path, "utf8");
				files.push({ name, path, mtimeMs, ...parseMailFile(text) });
			} catch {
				// file disappeared / unreadable mid-scan -- skip
			}
		}
		mailboxes.push({ id, files });
	}
	return mailboxes;
}

export async function scan() {
	return { journals: await scanJournals(), mailboxes: await scanMailboxes() };
}

// --- pure diagnose ----------------------------------------------------------

/**
 * Pure debounce step, mirroring watch-issues.mjs's `diagnose`. State carries,
 * per journal id, the last-notified snapshot signature (turn alerts) and,
 * per mailbox id, the set of mail filenames already notified (new-mail
 * alerts) so a quiet poll (nothing new) never re-emits.
 *
 * Mailboxes are scanned before journals so the journal loop can check a
 * turn-flip's `lastMail.in` against mail this monitor already surfaced in an
 * EARLIER tick (`prev.mailboxes`, not this tick's own new notifications --
 * issue #339). A flip whose triggering line cites already-surfaced mail is
 * the local session's own journal append echoing mail it has already been
 * told about; it carries no new information and is suppressed regardless of
 * who authored the line. A flip citing mail this monitor has not already
 * surfaced -- a genuine inbound turn, including one this same tick is
 * surfacing mail for the first time -- still fires.
 */
export function diagnose(current, prev) {
	const lines = [];
	const nextJournals = new Map();
	const nextMailboxes = new Map();
	const journalsByCounterpart = new Map();

	for (const journal of current.journals) {
		const existing = journalsByCounterpart.get(journal.counterpartId) ?? [];
		existing.push(journal);
		journalsByCounterpart.set(journal.counterpartId, existing);
	}

	// Effective "already seen" watermark for one journal, memoized per tick.
	// The journal's `lastMail.in` pointer is the precise answer, but it is absent
	// on a loop that has received nothing yet and stale if a hand-authored append
	// names a file that does not exist. Both cases previously fell back to 0,
	// which made every file in the mailbox newer than the watermark -- so
	// reopening a loop replayed the entire archive of the previous collaboration
	// as unread (#344).
	//
	// Falling back to the current loop's `loop-started` time bounds it correctly:
	// mail predating this collaboration cannot be new to it, and
	// `lastMail.in: null` stays honest for a freshly opened loop instead of
	// having to be back-dated to a previous loop's file to silence the noise.
	const thresholdCache = new Map();
	const thresholdFor = (journal) => {
		const cached = thresholdCache.get(journal.id);
		if (cached !== undefined) return cached;
		let threshold = journal.loopStartedAtMs ?? 0;
		const lastMailIn = journal.snapshot?.lastMail?.in;
		if (lastMailIn) {
			try {
				threshold = statSync(join(ROOT, lastMailIn)).mtimeMs;
			} catch {
				// dangling pointer -- keep the loop-started watermark
			}
		}
		thresholdCache.set(journal.id, threshold);
		return threshold;
	};

	for (const mailbox of current.mailboxes) {
		const journalsForCounterpart = journalsByCounterpart.get(mailbox.id) ?? [];
		const defaultJournal =
			journalsForCounterpart.find((journal) => journal.id === mailbox.id) ??
			(journalsForCounterpart.length === 1 ? journalsForCounterpart[0] : null);
		// A terminated loop is quiescent -- the turn-alert loop below already
		// refuses to fire for one, and SKILL.md states the monitor skips terminal
		// `unlinked` snapshots. The mail path has to agree: nothing can be new to
		// a loop that is over, so a closed loop must not lower the counterpart's
		// watermark. Left unfiltered, an `--exit`ed loop-scoped journal (kept on
		// purpose -- no delete, no archive step) drags the bar back to its own
		// `loop-started` and replays both loops' archives (#344).
		//
		// Once EVERY loop is closed the direction flips: the counterpart is judged
		// against the HIGHEST watermark among its closed loops, not the lowest.
		// Nothing any of them already processed can be new, but anything past all
		// of them still is -- and a fresh `request` arriving on a closed
		// collaboration is exactly how a session learns the counterpart wants to
		// reopen, which `--init` needs a prompt for. Skipping the file instead
		// swallowed that signal permanently: unannounced, it is also never
		// recorded, so a later `loop-started` moves the mark past its mtime and it
		// stays invisible. `unlinked` quiescence is scoped to the TURN alert
		// (SKILL.md), not to inbound mail. For a single journal this is exactly
		// the `lastMail.in` watermark the pre-loop-scoped monitor used.
		//
		// A counterpart with NO journal at all is a different case and keeps its
		// existing behavior: nothing has been journaled yet, so every file is new.
		const liveJournals = journalsForCounterpart.filter((journal) => journal.snapshot?.phase !== "unlinked");
		const allLoopsClosed = journalsForCounterpart.length > 0 && liveJournals.length === 0;
		const mailboxNext = new Map();

		for (const file of mailbox.files) {
			// `pinned` is the journal this file NAMES; `journal` is only the
			// attribution hint behind the label. Keeping them apart is the whole
			// point: a `loop:` key naming a journal that does not exist pins
			// nothing and must not silently claim the file for the default loop,
			// and a file with no `loop:` key at all is not pinned merely because
			// a default happens to exist.
			const pinned = file.loop
				? (journalsForCounterpart.find(
						(candidate) =>
							candidate.id === file.loop ||
							candidate.id === `${mailbox.id}.${file.loop}` ||
							candidate.loopId === file.loop,
					) ?? null)
				: null;
			const journal = pinned ?? defaultJournal;

			// UNPINNED mail belongs to the counterpart, not to one loop -- which
			// includes every file written before loop-scoped journals existed, so
			// it is the migration path, not a corner case. It is judged against
			// the LOWEST watermark among that counterpart's LIVE journals (new if
			// new to at least one open loop -- see above for the all-closed case,
			// where the rule inverts) and its notified state is recorded
			// under EVERY one of their ids, on every tick it is above the mark.
			//
			// Both halves have to key off `pinned`, not `journal`. Narrowing to
			// the default whenever one exists is what made a bare `effected.jsonl`
			// sitting beside `effected.loop-b.jsonl` record only under `effected`,
			// so the turn-flip check below -- which looks mail up by `journal.id`
			// -- missed it and re-fired for loop-b (#339). And a `?? 0` watermark
			// here would be the very 0 the note above warns against, replaying a
			// closed collaboration's archive (#344) the first tick after a second
			// loop opens.
			const fanOut = allLoopsClosed ? journalsForCounterpart : liveJournals;
			const candidates = pinned ? [pinned] : fanOut;
			const keys = candidates.length > 0 ? candidates.map((candidate) => candidate.id) : [mailbox.id];
			const watermarks = candidates.map(thresholdFor);
			const threshold =
				watermarks.length === 0 ? 0 : allLoopsClosed && !pinned ? Math.max(...watermarks) : Math.min(...watermarks);

			const notifiedSets = keys.map((key) => {
				let notified = mailboxNext.get(key);
				if (!notified) {
					notified = new Set(prev.mailboxes.get(key)?.notified ?? []);
					mailboxNext.set(key, notified);
				}
				return notified;
			});

			// Announce once, but record ALWAYS. A journal can appear after a file
			// was first surfaced -- `--init` opening a second loop for mail the
			// monitor just announced is the sequence this whole feature exists to
			// enable -- and its notified set starts empty. Keeping the `add` inside
			// the announce branch left that new key empty forever, because the
			// `.some()` above correctly suppressed the re-announce, so the new
			// loop's first `ball: ours` append fired a spurious turn alert (#339).
			if (file.mtimeMs > threshold) {
				if (!notifiedSets.some((notified) => notified.has(file.name))) {
					const fromLabel = journal && journal.id !== mailbox.id ? `${mailbox.id} (loop ${journal.id})` : mailbox.id;
					lines.push(`dogfood mail from ${fromLabel}: ${file.kind} (round ${file.round}) — ${file.heading}`);
				}
				for (const notified of notifiedSets) notified.add(file.name);
			}
		}

		for (const [key, notified] of mailboxNext.entries()) {
			nextMailboxes.set(key, { notified });
		}
	}

	for (const journal of current.journals) {
		const before = prev.journals.get(journal.id);
		const signature = JSON.stringify(journal.snapshot);
		const alreadyNotified = before?.signature === signature;
		const lastMailIn = journal.snapshot?.lastMail?.in;
		const priorNotified = prev.mailboxes.get(journal.id)?.notified;
		const selfEcho = Boolean(lastMailIn) && (priorNotified?.has(basename(lastMailIn)) ?? false);
		// A terminal `unlinked` snapshot is quiescent: the loop is done, so it
		// is not an actionable turn regardless of `ball`. The journal is kept
		// after `unlinked` (a future collaboration continues it), and the
		// per-process notify-dedupe resets every session, so without this gate
		// a finished loop re-fires the turn alert on each new session
		// (issue #314). Appending a fresh non-`unlinked` loop line reopens it.
		if (
			journal.snapshot &&
			!alreadyNotified &&
			journal.snapshot.ball === "ours" &&
			journal.snapshot.phase !== "unlinked" &&
			!selfEcho
		) {
			lines.push(`dogfood: ball is ours in loop "${journal.id}" (phase: ${journal.snapshot.phase ?? "?"})`);
		}
		nextJournals.set(journal.id, { signature });
	}

	return { lines, next: { journals: nextJournals, mailboxes: nextMailboxes } };
}

// --- main --------------------------------------------------------------------

async function main() {
	const once = process.argv.includes("--once");
	let prev = { journals: new Map(), mailboxes: new Map() };
	const tick = async () => {
		try {
			const { lines, next } = diagnose(await scan(), prev);
			prev = next;
			for (const line of lines) console.log(line);
		} catch {
			// never crash the session
		}
	};
	await tick();
	if (!once) {
		const loop = async () => {
			await tick();
			setTimeout(loop, POLL_MS);
		};
		setTimeout(loop, POLL_MS);
	}
}

// Compare via realpathSync so a symlinked plugin root (argv[1] is the
// symlink, import.meta.url the resolved real path) still matches -- same
// rationale as watch-issues.mjs.
function invokedDirectly() {
	const entry = process.argv[1];
	if (!entry) return false;
	try {
		return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
}

if (invokedDirectly()) {
	await main();
}

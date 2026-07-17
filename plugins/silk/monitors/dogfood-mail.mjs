#!/usr/bin/env node
// Background monitor: the fs-only half of the dogfood mailbox protocol (see
// skills/dogfood/SKILL.md and docs/superpowers/specs/
// 2026-07-16-dogfood-mailbox-skill-design.md). Watches two LOCAL things only
// -- no network, ever, per the spec's monitor rule:
//
//   1. Inbound mailboxes ".claude/dogfood/<counterpart-id>/*.md" -- files
//      newer than the loop's journaled `lastMail.in`, not yet notified.
//   2. Journals ".claude/dogfood/*.jsonl" -- a new tail line (JSONL
//      snapshot-lines; current state is the last VALID line) whose `ball` is
//      "ours".
//
// Sibling of watch-issues.mjs: same self-scheduling poll loop, same
// `diagnose(current, prev)` pure-function shape so it's importable by tests
// without starting the interval, same `--once` single-shot mode.
import { globSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
			journals.push({ id, path, snapshot });
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
 */
export function diagnose(current, prev) {
	const lines = [];
	const nextJournals = new Map();
	const nextMailboxes = new Map();

	for (const journal of current.journals) {
		const before = prev.journals.get(journal.id);
		const signature = JSON.stringify(journal.snapshot);
		const alreadyNotified = before?.signature === signature;
		if (journal.snapshot && !alreadyNotified && journal.snapshot.ball === "ours") {
			lines.push(`dogfood: ball is ours in loop "${journal.id}" (phase: ${journal.snapshot.phase ?? "?"})`);
		}
		nextJournals.set(journal.id, { signature });
	}

	for (const mailbox of current.mailboxes) {
		const journal = current.journals.find((j) => j.id === mailbox.id);
		const lastMailIn = journal?.snapshot?.lastMail?.in;
		let threshold = 0;
		if (lastMailIn) {
			try {
				threshold = statSync(join(ROOT, lastMailIn)).mtimeMs;
			} catch {
				threshold = 0;
			}
		}
		const before = prev.mailboxes.get(mailbox.id);
		const notified = new Set(before?.notified ?? []);
		for (const file of mailbox.files) {
			if (file.mtimeMs > threshold && !notified.has(file.name)) {
				lines.push(`dogfood mail from ${mailbox.id}: ${file.kind} (round ${file.round}) — ${file.heading}`);
				notified.add(file.name);
			}
		}
		nextMailboxes.set(mailbox.id, { notified });
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

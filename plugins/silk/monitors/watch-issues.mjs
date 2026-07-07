#!/usr/bin/env node
// Background monitor: polls dist/<target>/issues.json artifacts and prints one
// notification line per package once its ae-*/tsdoc- count settles at a
// non-zero value. A count that is still moving build-to-build — an agent
// actively fixing diagnostics (the peeling-the-onion pattern), or a fresh
// package mid-build — is held back until it holds steady across a short quiet
// period, so the monitor never tells the session to "dispatch the tsdoctor
// agent" for a package a fixing agent is already working on
// (see savvy-web/systems#248).
import { globSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const TSDOC_CODE = /^(ae-|tsdoc-)/;
const POLL_MS = 2000;
// Consecutive polls a non-zero count must hold, unchanged, before the monitor
// notifies. With POLL_MS=2000 the default (3) is a ~6s quiet period. A build
// in progress keeps the count changing, resetting the streak, so mid-fix
// churn never fires. Override with SILK_TSDOC_MONITOR_STABLE_POLLS (0 restores
// the old fire-immediately behavior).
const STABLE_POLLS = Math.max(0, Number(process.env.SILK_TSDOC_MONITOR_STABLE_POLLS ?? 3) || 0);

function countTsdocIssues(issues) {
	const all = [...(issues?.warnings ?? []), ...(issues?.errors ?? [])];
	return all.filter((d) => typeof d?.code === "string" && TSDOC_CODE.test(d.code)).length;
}

async function scan() {
	const files = globSync(["**/dist/dev/issues.json", "**/dist/prod/issues.json"], {
		cwd: ROOT,
		exclude: (p) => p.includes("node_modules"),
	});
	const current = [];
	for (const rel of files) {
		const path = join(ROOT, rel);
		try {
			const issues = JSON.parse(await readFile(path, "utf8"));
			current.push({
				path,
				pkg: typeof issues?.package === "string" ? issues.package : rel,
				target: typeof issues?.target === "string" ? issues.target : "?",
				count: countTsdocIssues(issues),
			});
		} catch {
			// partial write / parse error — skip and retry on the next poll
		}
	}
	return current;
}

// Pure debounce step. State per path carries the current count, how many
// consecutive scans it has held that count (`streak`), and the last count we
// notified about (`notified`). A non-zero count fires only once its streak
// reaches `minStablePolls` and it differs from the last-notified value — so a
// count that keeps changing (active fixing) never fires, a new stable value
// fires exactly once, and a return to zero clears the dedup so a later
// regression can fire again.
export function diagnose(current, prev, minStablePolls) {
	const lines = [];
	const next = new Map();
	for (const c of current) {
		const before = prev.get(c.path);
		const streak = before && before.count === c.count ? before.streak + 1 : 0;
		let notified = before?.notified;
		if (c.count === 0) {
			notified = undefined;
		} else if (streak >= minStablePolls && notified !== c.count) {
			const plural = c.count === 1 ? "" : "s";
			lines.push(
				`tsdoc: ${c.pkg} has ${c.count} ae-*/tsdoc- issue${plural} in ${c.target} — dispatch the tsdoctor agent or /silk:tsdoc to fix, unless an agent is already working this package: if a build or fixing agent is in flight, let it finish before dispatching another rather than acting on this line immediately`,
			);
			notified = c.count;
		}
		next.set(c.path, { count: c.count, streak, notified });
	}
	return { lines, next };
}

async function main() {
	const once = process.argv.includes("--once");
	// --once is a single-shot check with no polling history to build a quiet
	// period from, so it reports current non-zero counts immediately.
	const minStablePolls = once ? 0 : STABLE_POLLS;
	let prev = new Map();
	const tick = async () => {
		try {
			const { lines, next } = diagnose(await scan(), prev, minStablePolls);
			prev = next;
			for (const line of lines) console.log(line);
		} catch {
			// never crash the session
		}
	};
	await tick();
	// Self-scheduling rather than setInterval: each scan must finish before the
	// next starts. Overlapping ticks would both read the same `prev` snapshot
	// before either writes it back, losing streak increments and corrupting the
	// debounce state.
	if (!once) {
		const loop = async () => {
			await tick();
			setTimeout(loop, POLL_MS);
		};
		setTimeout(loop, POLL_MS);
	}
}

// Only run the polling loop when invoked as a script, so `diagnose` can be
// imported by tests without starting the interval. Compare via realpathSync so
// a symlinked plugin root (argv[1] is the symlink, import.meta.url the resolved
// real path) still matches — otherwise the monitor would silently never start.
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

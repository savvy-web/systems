#!/usr/bin/env node
// Background monitor: polls dist/<target>/issues.json artifacts and prints one
// notification line per package once its ae-*/tsdoc- count settles at a
// non-zero value. A count that is still moving build-to-build — an agent
// actively fixing diagnostics (the peeling-the-onion pattern), or a fresh
// package mid-build — is held back until it holds steady across a short quiet
// period (see savvy-web/systems#248).
//
// dist/<target>/issues.json is a gitignored, shared, mutable artifact, which
// makes it a poor channel for cross-agent evidence: a stray build from another
// tree rewrites it, a crashed build writes an all-zeros version of it, and a
// reviewer proving a fix is load-bearing MUST reintroduce the bug and rebuild.
// A watcher that reports whatever it finds observes all three as regressions.
// One session fired five events on one package, none of which described HEAD,
// and two agents came within one instruction of "fixing" a symbol deleted two
// commits earlier (savvy-web/systems#255). Three gates below exist for that:
// buildOk, artifact-newer-than-source, and clean-tree. Each is a reason to
// stay quiet, never a reason to report harder — an artifact this monitor
// cannot vouch for produces no line at all.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { globSync, readFileSync, realpathSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const TSDOC_CODE = /^(ae-|tsdoc-)/;
const SOURCE_EXT = /\.(ts|tsx|mts|cts)$/;
const POLL_MS = 2000;
// Consecutive polls a non-zero count must hold, unchanged, before the monitor
// notifies. With POLL_MS=2000 the default (3) is a ~6s quiet period. A build
// in progress keeps the count changing, resetting the streak, so mid-fix
// churn never fires. Override with SILK_TSDOC_MONITOR_STABLE_POLLS (0 restores
// the old fire-immediately behavior).
const STABLE_POLLS = Math.max(0, Number(process.env.SILK_TSDOC_MONITOR_STABLE_POLLS ?? 3) || 0);
// How long a lock may go untouched before a rival treats it as abandoned. The
// holder refreshes its lock's mtime every tick, so this only elapses when the
// holder is gone — which is the one case a pid probe cannot detect, because a
// recycled pid answers `kill(pid, 0)` exactly like the original holder.
const STALE_LOCK_MS = POLL_MS * 5;

function countTsdocIssues(issues) {
	const all = [...(issues?.warnings ?? []), ...(issues?.errors ?? [])];
	return all.filter((d) => typeof d?.code === "string" && TSDOC_CODE.test(d.code)).length;
}

// Newest mtime among the package's own sources. `undefined` when the package
// has no source tree we can see — treated as "cannot vouch", same as a stale
// artifact, rather than as a pass.
function newestSourceMtime(pkgDir) {
	let newest;
	try {
		for (const rel of globSync("src/**/*", { cwd: pkgDir, exclude: (p) => p.includes("node_modules") })) {
			if (!SOURCE_EXT.test(rel)) continue;
			const ms = statSync(join(pkgDir, rel)).mtimeMs;
			if (newest === undefined || ms > newest) newest = ms;
		}
	} catch {
		return undefined;
	}
	return newest;
}

// One `git status` per tick at most, and only once something is otherwise
// ready to fire. A dirty working tree is normal during a review and poisons
// the build the artifact came from, so a package with uncommitted or untracked
// sources is not reported on at all.
function dirtySourcePaths() {
	try {
		const out = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
			cwd: ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		const paths = new Set();
		for (const line of out.split("\n")) {
			// "XY path", or "XY old -> new" for a rename — the destination is
			// the one that exists in the tree the build read.
			let path = line.slice(3).trim();
			const arrow = path.lastIndexOf(" -> ");
			if (arrow !== -1) path = path.slice(arrow + 4);
			if (!path || !SOURCE_EXT.test(path)) continue;
			paths.add(path);
		}
		return paths;
	} catch {
		// No git, not a repo, git unavailable — no cleanliness claim either way.
		return undefined;
	}
}

async function scan() {
	const files = globSync(["**/dist/dev/issues.json", "**/dist/prod/issues.json"], {
		cwd: ROOT,
		exclude: (p) => p.includes("node_modules"),
	});
	const current = [];
	for (const rel of files) {
		const path = join(ROOT, rel);
		// <pkg>/dist/<target>/issues.json — up three to the package root.
		const pkgDir = dirname(dirname(dirname(path)));
		try {
			const issues = JSON.parse(await readFile(path, "utf8"));
			const newestSrc = newestSourceMtime(pkgDir);
			current.push({
				path,
				pkgDir,
				pkg: typeof issues?.package === "string" ? issues.package : rel,
				target: typeof issues?.target === "string" ? issues.target : "?",
				count: countTsdocIssues(issues),
				// Three-state, deliberately: true / false / undefined. An
				// artifact written by a bundler predating the stamp cannot be
				// vouched for, and `?? false`-style collapsing would turn
				// "unknown" into a claim.
				buildOk: typeof issues?.buildOk === "boolean" ? issues.buildOk : undefined,
				fresh: newestSrc === undefined ? undefined : statSync(path).mtimeMs >= newestSrc,
			});
		} catch {
			// partial write / parse error — skip and retry on the next poll
		}
	}
	return current;
}

// Pure debounce + provenance step. State per path carries the current count,
// how many consecutive scans it has held that count (`streak`), and the last
// count we notified about (`notified`). A non-zero count fires only once its
// streak reaches `minStablePolls`, it differs from the last-notified value,
// and the artifact can be vouched for — so a count that keeps changing (active
// fixing) never fires, a new stable value fires exactly once, and a return to
// zero clears the dedup so a later regression can fire again.
//
// `isDirty` is injected rather than called here so this stays pure and
// testable; it is consulted lazily, only for a candidate that has already
// cleared every other gate.
export function diagnose(current, prev, minStablePolls, isDirty = () => false) {
	const lines = [];
	const next = new Map();
	for (const c of current) {
		const before = prev.get(c.path);
		const streak = before && before.count === c.count ? before.streak + 1 : 0;
		let notified = before?.notified;
		if (c.count === 0) {
			notified = undefined;
		} else if (streak >= minStablePolls && notified !== c.count) {
			// buildOk false: the build crashed and wrote a torn artifact whose
			// diagnostics describe nothing. buildOk absent: unknown provenance.
			// fresh false: the artifact predates a source edit, so it is some
			// earlier tree's gate. dirty: a review or a mid-fix tree, where
			// breakage is expected and reporting it un-commits work.
			const vouched = c.buildOk === true && c.fresh === true && !isDirty(c);
			if (vouched) {
				const plural = c.count === 1 ? "" : "s";
				lines.push(
					`tsdoc: ${c.pkg} has ${c.count} ae-*/tsdoc- issue${plural} in ${c.target}. Read ${relative(ROOT, c.path) || c.path} for the entries before acting — this line reports an artifact, not the state of any agent's in-flight work.`,
				);
				notified = c.count;
			}
		}
		next.set(c.path, { count: c.count, streak, notified });
	}
	return { lines, next };
}

// Per-project single-instance lock. Monitors are respawned per session and
// were never deduplicated: one repo accumulated 70 live watchers, so a single
// event fired six times with an identical payload, and each firing woke every
// idle agent — several of which rebuilt to investigate, rewriting the artifact
// and re-firing the monitor (savvy-web/systems#255). The lock is advisory: a
// stale pid file (holder gone) is taken over, never trusted.
//
// Acquisition is an exclusive create, NOT a read-then-write. A read-then-write
// re-opens the very race the lock closes: two monitors cold-starting in the
// same instant both find no file, both write, and both run — the duplication
// this exists to stop. `wx` fails with EEXIST when the path already exists, so
// exactly one writer wins no matter how the starts interleave.
function claimLock() {
	const key = createHash("sha256").update(realpathish(ROOT)).digest("hex").slice(0, 16);
	const lockPath = join(tmpdir(), `silk-tsdoc-monitor-${key}.pid`);
	// Two attempts at most: the first claim, and one retry after reclaiming a
	// lock whose holder is gone. A second EEXIST means another starter won the
	// reclaim, which is a decided outcome rather than something to spin on.
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			writeFileSync(lockPath, String(process.pid), { flag: "wx" });
			return { lockPath, release: releaseFn(lockPath) };
		} catch (err) {
			if (err?.code !== "EEXIST") {
				// Cannot write a lock at all (read-only tmp): run unlocked
				// rather than not at all. Only a genuine EEXIST means "held".
				// Same object shape as the success path — a bare function here
				// left `claimed.release` undefined, and `process.on("exit",
				// undefined)` throws, killing the monitor on the one path whose
				// whole point is to keep it alive. Omitting `lockPath` is what
				// tells the tick loop to skip the heartbeat.
				return { release: () => {} };
			}
		}
		if (lockIsHeld(lockPath)) return null;
		try {
			unlinkSync(lockPath);
		} catch {
			// Another starter reclaimed it first; the retry's EEXIST settles it.
		}
	}
	return null;
}

// Whether the lock is still HELD. Two things a pid probe alone cannot settle,
// both of which strand the monitor permanently rather than transiently:
//
//   1. `wx` is `open(O_CREAT|O_EXCL)` followed by a SEPARATE `write()`, so the
//      path exists while the file is still zero-length. A rival reading in that
//      window sees "", which is not a pid — and if that counted as "no holder"
//      it would unlink a live holder's lock and both watchers would run, the
//      exact duplication this is here to stop. So a freshly-stamped file that
//      does not parse is a rival mid-write: yield to it.
//   2. `process.kill(pid, 0)` cannot tell the original holder from an unrelated
//      process that later inherited the pid. A SIGKILLed watcher never runs its
//      release, the OS recycles the pid, and from then on every new watcher
//      probes that pid, finds it "alive", and exits — silently, forever, until
//      someone deletes a file in tmp they have no reason to suspect. The
//      heartbeat is what breaks that: a real holder refreshes the lock's mtime
//      every tick, so a lock that has gone quiet for STALE_LOCK_MS is abandoned
//      no matter what the pid probe says.
function lockIsHeld(lockPath) {
	let age = Number.POSITIVE_INFINITY;
	try {
		age = Date.now() - statSync(lockPath).mtimeMs;
	} catch {
		return false; // vanished between the EEXIST and this read
	}
	let held;
	try {
		held = Number(readFileSync(lockPath, "utf8").trim());
	} catch {
		held = Number.NaN;
	}
	if (!Number.isInteger(held) || held <= 0) {
		// Empty or garbage. Fresh means a rival is mid-write (case 1); old
		// means a process died between create and write, so reclaim it.
		return age < STALE_LOCK_MS;
	}
	// Our own pid in the file is a leftover of ours, not a rival holder.
	if (held === process.pid) return false;
	let alive;
	try {
		process.kill(held, 0);
		alive = true;
	} catch (err) {
		// EPERM means alive but owned by another uid; only a missing process
		// counts as gone.
		alive = err?.code === "EPERM";
	}
	// A live pid with a stale heartbeat is case 2 — treat it as abandoned.
	return alive && age < STALE_LOCK_MS;
}

// Refresh our lock's mtime so rivals can tell a live holder from a recycled
// pid. Only ever touches a file that still names this process.
function heartbeat(lockPath) {
	try {
		if (readFileSync(lockPath, "utf8").trim() !== String(process.pid)) return;
		const now = new Date();
		utimesSync(lockPath, now, now);
	} catch {
		/* lock gone or unwritable — the next claim settles it */
	}
}

function releaseFn(lockPath) {
	return () => {
		try {
			if (readFileSync(lockPath, "utf8").trim() === String(process.pid)) unlinkSync(lockPath);
		} catch {
			/* nothing to release */
		}
	};
}

function realpathish(p) {
	try {
		return realpathSync(p);
	} catch {
		return p;
	}
}

async function main() {
	const once = process.argv.includes("--once");
	// --once is a single-shot check with no polling history to build a quiet
	// period from, so it reports current non-zero counts immediately. It also
	// skips the lock: it is a diagnostic invocation, not a resident watcher.
	const minStablePolls = once ? 0 : STABLE_POLLS;
	let lockPath;
	if (!once) {
		const claimed = claimLock();
		if (claimed === null) return; // another watcher already owns this project
		lockPath = claimed.lockPath;
		process.on("exit", claimed.release);
		for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => process.exit(0));
	}
	let prev = new Map();
	const tick = async () => {
		try {
			if (lockPath !== undefined) heartbeat(lockPath);
			const current = await scan();
			let dirtyPaths;
			const isDirty = (c) => {
				dirtyPaths ??= dirtySourcePaths();
				if (dirtyPaths === undefined) return false;
				const rel = relative(ROOT, c.pkgDir);
				// Scoped to the same files gate 2 measures, plus the build
				// entry. A prefix match over the WHOLE package directory would
				// disagree with `newestSourceMtime` (which reads `src/**` only)
				// and silence the monitor for an uncommitted `__test__/*.ts` or
				// `vitest.config.ts` — neither of which is an input to the
				// `ae-*`/`tsdoc-*` pass, so the artifact still describes
				// committed `src/` accurately. `savvy.build.ts` IS an input
				// (it carries `meta.tsdoc.suppressWarnings`), so it counts.
				const base = rel === "" ? "" : `${rel}${sep}`;
				const srcPrefix = `${base}src${sep}`;
				const buildEntry = `${base}savvy.build.ts`;
				for (const p of dirtyPaths) {
					if (p.startsWith(srcPrefix) || p === buildEntry) return true;
				}
				return false;
			};
			const { lines, next } = diagnose(current, prev, minStablePolls, isDirty);
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

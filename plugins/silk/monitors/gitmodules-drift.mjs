#!/usr/bin/env node
// Background monitor: watches the two local sources the vendored-repos
// manifest is reconciled against -- <project>/.gitmodules and
// <project>/.repos/config.json (see skills/repos/SKILL.md) -- and notifies
// when `savvy repos status --drift --json` reports drift between the
// manifest, .gitmodules, the worktree, and `git submodule status`.
//
// Filesystem + subprocess only -- no network, ever. Never mutates anything:
// this only ever runs the read-only `repos status --drift` report.
//
// Fails open (silent) whenever the savvy CLI is not available in this
// project, same posture and probe (`<runner> savvy --version`) as
// hooks/post-tool-use/changeset-validate-changeset.sh.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, watch } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const REPOS_DIR = join(ROOT, ".repos");
// Debounce window for a burst of fs.watch events (e.g. an editor's
// write-then-rename save sequence) collapsing into a single drift check.
// Kept >= 500ms per the monitor's spec.
const DEBOUNCE_MS = 500;

// --- package manager resolution --------------------------------------------

/**
 * Detect the package manager for `root`. Mirrors
 * hooks/lib/hook-env.sh's detect_package_manager/package_manager_exec:
 * prefer SILK_PACKAGE_MANAGER (SessionStart's cached detection, same env var
 * changeset-validate-changeset.sh reads), then the package.json
 * "packageManager" field, then a lockfile, falling open to npm at every step.
 */
export function detectPackageManager(root) {
	const cached = process.env.SILK_PACKAGE_MANAGER;
	if (cached) return cached;
	try {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		const field = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : "";
		if (field) return field;
	} catch {
		// no package.json / unreadable / malformed -- fall through to lockfiles
	}
	if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(join(root, "yarn.lock"))) return "yarn";
	if (existsSync(join(root, "bun.lock"))) return "bun";
	return "npm";
}

/** Runner argv prefix (including the "savvy" binary name) for a package manager. */
function runnerFor(pm) {
	switch (pm) {
		case "pnpm":
			return ["pnpm", "exec", "savvy"];
		case "yarn":
			return ["yarn", "exec", "savvy"];
		case "bun":
			return ["bunx", "savvy"];
		default:
			return ["npx", "--no", "--", "savvy"];
	}
}

// --- drift check -------------------------------------------------------------

/**
 * Run `savvy repos status --drift --json` and return the parsed payload, or
 * null when the CLI is unavailable or its output is not parseable JSON.
 *
 * `savvy repos status --drift` intentionally exits 1 when drift (or a plain
 * !clean status) is present, mirroring the CLI's existing convention -- that
 * is data, not failure, so only a genuine spawn error or unparseable stdout
 * falls back to null. The `--version` probe first (same as
 * changeset-validate-changeset.sh) keeps the "CLI unavailable" case
 * (unknown command, project has no savvy installed, ...) from ever reaching
 * the drift call at all.
 */
export function checkDrift(root = ROOT) {
	const [bin, ...rest] = runnerFor(detectPackageManager(root));
	let probe;
	try {
		probe = spawnSync(bin, [...rest, "--version"], { cwd: root, encoding: "utf8" });
	} catch {
		return null;
	}
	if (probe.error || probe.status !== 0) return null;

	let result;
	try {
		result = spawnSync(bin, [...rest, "repos", "status", "--drift", "--json"], { cwd: root, encoding: "utf8" });
	} catch {
		return null;
	}
	if (result.error || typeof result.stdout !== "string") return null;
	try {
		return JSON.parse(result.stdout);
	} catch {
		return null;
	}
}

// --- pure diagnose ------------------------------------------------------------

/**
 * Pure formatting step: given the parsed `repos status --drift --json`
 * payload (or null, for "CLI unavailable" / "unparseable"), return one line
 * per detected drift naming its kind -- or no lines at all when the payload
 * is absent or reports no drift. Mirrors the CLI's own
 * `${name}: ${kind} — ${detail}` per-drift line (packages/cli's
 * `repos status` handler).
 */
export function diagnose(payload) {
	const drifts = payload?.drift?.drifts;
	if (!Array.isArray(drifts) || drifts.length === 0) return [];
	return drifts.map((d) => `.repos drift: ${d?.name ?? "?"}: ${d?.kind ?? "?"} — ${d?.detail ?? "(no detail)"}`);
}

function notify(root = ROOT) {
	try {
		for (const line of diagnose(checkDrift(root))) console.log(line);
	} catch {
		// never crash the session
	}
}

// --- main ----------------------------------------------------------------------

/**
 * Watch a directory for a specific filename, tolerating the directory not
 * existing yet (e.g. a project with nothing vendored has no .repos/ at all).
 * Returns the FSWatcher, or null if the directory could not be watched.
 */
function watchFileIn(dir, filename, onEvent) {
	try {
		return watch(dir, (_event, changedFile) => {
			if (changedFile === filename) onEvent();
		});
	} catch {
		return null;
	}
}

async function main() {
	const once = process.argv.includes("--once");
	if (once) {
		notify();
		return;
	}

	let timer = null;
	const scheduled = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(notify, DEBOUNCE_MS);
	};

	// .gitmodules lives directly under the project root, which always exists.
	watchFileIn(ROOT, ".gitmodules", scheduled);

	// .repos/config.json needs .repos/ to exist first. If it is missing at
	// startup (nothing vendored yet), watch the root for the directory's
	// creation and establish the config.json watcher once it appears.
	let reposWatcher = watchFileIn(REPOS_DIR, "config.json", scheduled);
	if (!reposWatcher) {
		watchFileIn(ROOT, ".repos", () => {
			if (!reposWatcher) reposWatcher = watchFileIn(REPOS_DIR, "config.json", scheduled);
			scheduled();
		});
	}
}

// Compare via realpathSync so a symlinked plugin root (argv[1] is the
// symlink, import.meta.url the resolved real path) still matches -- same
// rationale as the sibling monitors.
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

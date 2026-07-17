/**
 * `savvy clean` — remove build/cache artifacts across a silk workspace.
 *
 * Globs a set of patterns at the top level of each workspace root (leaves
 * first, monorepo root last) and deletes matches. `--dry-run` previews without
 * touching disk. Uses Node's native `fs.promises.glob` (no third-party glob).
 *
 * @internal
 */

import { glob as nodeGlob, realpath, rm } from "node:fs/promises";
import { join, sep } from "node:path";
import { WorkspaceDiscovery } from "@effected/workspaces";
import { Data, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

/** Default patterns cleaned when `--globs` is omitted. */
const DEFAULT_GLOBS = ["dist", ".turbo", "coverage", "node_modules", ".rslib"];

/** Directory names a recursive (`**`) glob must never descend into. */
const NO_DESCEND = new Set(["node_modules", ".git"]);

/** A single removable artifact. */
export interface Target {
	readonly path: string;
	readonly kind: "dir" | "file";
}

/** Unexpected failure while planning or removing artifacts. */
export class CleanError extends Data.TaggedError("CleanError")<{
	readonly step: string;
	readonly reason: string;
}> {}

/**
 * Glob `patterns` at the top of `pkgPath`, classify dir vs file, and enforce
 * that every match stays within `pkgPath` (rejecting symlink/`..` escapes and
 * the root directory itself).
 */
export function collectTargets(pkgPath: string, patterns: ReadonlyArray<string>): Effect.Effect<Target[], CleanError> {
	return Effect.tryPromise({
		try: async () => {
			const rootReal = await realpath(pkgPath);
			const seen = new Map<string, Target>();
			for await (const entry of nodeGlob(patterns as string[], {
				cwd: pkgPath,
				withFileTypes: true,
				// Block descent into heavy/VCS dirs for recursive patterns. A
				// top-level node_modules is still matched (this only blocks descent).
				exclude: (dirent) => NO_DESCEND.has(dirent.name) && dirent.isDirectory(),
			})) {
				const abs = join(entry.parentPath, entry.name);
				// Containment: resolve symlinks and reject anything outside the root
				// or the root/package.json itself.
				let real: string;
				try {
					real = await realpath(abs);
				} catch {
					continue; // vanished between glob and stat
				}
				if (real === rootReal || !real.startsWith(rootReal + sep)) continue;
				// Never delete the workspace root's own package.json. Compare the
				// resolved path against `<rootReal>/package.json` so the guard
				// survives a symlinked or non-normalized `pkgPath` (a raw
				// `entry.parentPath === pkgPath` check would not).
				if (real === join(rootReal, "package.json")) continue;
				seen.set(abs, { path: abs, kind: entry.isDirectory() ? "dir" : "file" });
			}
			return [...seen.values()];
		},
		catch: (e) => new CleanError({ step: `glob ${pkgPath}`, reason: e instanceof Error ? e.message : String(e) }),
	});
}

/** Outcome of a removal pass. */
export interface RemovalReport {
	readonly removed: ReadonlyArray<Target>;
	readonly failed: ReadonlyArray<{ readonly target: Target; readonly reason: string }>;
}

/** Max concurrent deletions. */
const REMOVE_CONCURRENCY = 8;

/**
 * Delete each target (`rm -rf`, missing paths are no-ops via `force`). On
 * `dryRun`, report without deleting. Per-target failures are collected, not
 * thrown, so one unremovable path does not abort the rest.
 */
export function removeTargets(targets: ReadonlyArray<Target>, dryRun: boolean): Effect.Effect<RemovalReport> {
	return Effect.gen(function* () {
		const results = yield* Effect.forEach(
			targets,
			(target) =>
				dryRun
					? Effect.succeed({ target, reason: null as string | null })
					: Effect.tryPromise(() => rm(target.path, { recursive: true, force: true })).pipe(
							Effect.match({
								onSuccess: () => ({ target, reason: null as string | null }),
								onFailure: (e) => ({ target, reason: e instanceof Error ? e.message : String(e) }),
							}),
						),
			{ concurrency: REMOVE_CONCURRENCY },
		);
		return {
			removed: results.filter((r) => r.reason === null).map((r) => r.target),
			failed: results.filter((r) => r.reason !== null).map((r) => ({ target: r.target, reason: r.reason as string })),
		};
	});
}

/** Unicode symbols for output. */
const CHECK_MARK = "✓";
const BULLET = "•";
const WARN_MARK = "⚠";

/** Split the comma-separated `--globs` value; fall back to defaults when empty. */
export function parseGlobs(raw: string): string[] {
	const parts = raw
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	return parts.length > 0 ? parts : DEFAULT_GLOBS;
}

/**
 * Discover packages, plan targets per workspace (leaves first, root last),
 * dedup across overlapping roots, remove (or preview), and report.
 */
export function runClean(opts: {
	globs: string;
	dryRun: boolean;
}): Effect.Effect<void, CleanError, WorkspaceDiscovery> {
	const patterns = parseGlobs(opts.globs);
	return Effect.gen(function* () {
		const discovery = yield* WorkspaceDiscovery;
		const packages = yield* discovery
			.listPackages()
			.pipe(Effect.mapError((e) => new CleanError({ step: "discover workspaces", reason: e.message })));

		// Order: non-root packages (leaves) first, the root workspace last.
		const leaves = packages.filter((p) => !(p.relativePath === "."));
		const roots = packages.filter((p) => p.relativePath === ".");
		const ordered = [...leaves, ...roots];

		// Plan per workspace (concurrent), then dedup paths globally in order so a
		// path matched under a leaf is not re-listed under the root.
		const planned = yield* Effect.forEach(ordered, (pkg) =>
			collectTargets(pkg.path, patterns).pipe(Effect.map((targets) => ({ pkg, targets }))),
		);
		const seen = new Set<string>();
		const groups = planned.map(({ pkg, targets }) => {
			const unique = targets.filter((t) => {
				if (seen.has(t.path)) return false;
				seen.add(t.path);
				return true;
			});
			return { pkg, targets: unique };
		});

		const leafGroups = groups.filter((g) => !(g.pkg.relativePath === "."));
		const rootGroups = groups.filter((g) => g.pkg.relativePath === ".");

		const verb = opts.dryRun ? "would remove" : "removed";
		let total = 0;
		const failures: { target: Target; reason: string }[] = [];

		// Remove leaves first, then the root, so the root is cleaned last.
		for (const phase of [leafGroups, rootGroups]) {
			const reports = yield* Effect.forEach(phase, (g) =>
				removeTargets(g.targets, opts.dryRun).pipe(Effect.map((report) => ({ g, report }))),
			);
			for (const { g, report } of reports) {
				if (g.targets.length === 0) continue;
				yield* Effect.log(`\n${g.pkg.relativePath === "." ? "<root>" : g.pkg.relativePath}`);
				// Only report items that actually succeeded (in dry-run, `removed`
				// holds every target). Failures are printed inline with a distinct
				// marker rather than mislabeled as removed.
				for (const t of report.removed) {
					yield* Effect.log(`  ${BULLET} ${verb} [${t.kind}] ${t.path}`);
				}
				for (const f of report.failed) {
					yield* Effect.log(`  ${WARN_MARK} failed [${f.target.kind}] ${f.target.path}: ${f.reason}`);
				}
				total += report.removed.length;
				failures.push(...report.failed);
			}
		}

		yield* Effect.log(`\n${CHECK_MARK} ${opts.dryRun ? "Would remove" : "Removed"} ${total} item(s).`);
		if (failures.length > 0) {
			for (const f of failures) {
				yield* Effect.logError(`Failed to remove ${f.target.path}: ${f.reason}`);
			}
			return yield* Effect.fail(
				new CleanError({ step: "remove", reason: `${failures.length} target(s) could not be removed` }),
			);
		}
	});
}

/* v8 ignore start -- CLI option/registration; orchestration tested via runClean */
const globsOption = Flag.string("globs").pipe(
	Flag.withAlias("g"),
	Flag.withDescription(
		`Comma-separated glob patterns to remove from each workspace root (default: ${DEFAULT_GLOBS.join(",")})`,
	),
	Flag.withDefault(DEFAULT_GLOBS.join(",")),
);

const dryRunOption = Flag.boolean("dry-run").pipe(
	Flag.withAlias("n"),
	Flag.withDescription("Report what would be removed without deleting anything"),
	Flag.withDefault(false),
);

const _cleanCommand = Command.make("clean", { globs: globsOption, dryRun: dryRunOption }, (opts) =>
	runClean(opts),
).pipe(Command.withDescription("Remove build/cache artifacts across the workspace (leaves first, root last)"));
/* v8 ignore stop */

/**
 * The `savvy clean` command for the root assembly.
 *
 * @remarks
 * Typed with `any` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal Command types, matching the other top-level
 * command exports.
 */
export const cleanCommand = _cleanCommand;

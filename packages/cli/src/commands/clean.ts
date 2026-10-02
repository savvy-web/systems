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
import type { Block } from "@effected/cli";
import { CliInteractive } from "@effected/cli";
import { CliUi } from "@effected/cli/ui";
import { WorkspaceDiscovery } from "@effected/workspaces";
import { Console, Effect, PubSub } from "effect";
import { Command, Flag } from "effect/cli";
import { CommandError } from "../internal/command-error.js";
import type { ReportEnv } from "../internal/report.js";
import { Report } from "../internal/report.js";
import type { CleanEvent, FailedTarget, Target } from "./clean/progress.js";

export type { FailedTarget, Target } from "./clean/progress.js";

/** Default patterns cleaned when `--globs` is omitted. */
const DEFAULT_GLOBS = ["dist", ".turbo", "coverage", "node_modules", ".rslib"];

/** Directory names a recursive (`**`) glob must never descend into. */
const NO_DESCEND = new Set(["node_modules", ".git"]);

/**
 * Glob `patterns` at the top of `pkgPath`, classify dir vs file, and enforce
 * that every match stays within `pkgPath` (rejecting symlink/`..` escapes and
 * the root directory itself).
 */
export function collectTargets(
	pkgPath: string,
	patterns: ReadonlyArray<string>,
): Effect.Effect<Target[], CommandError> {
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
		catch: (e) =>
			CommandError.from(e, {
				message: `could not list the artifacts in ${pkgPath}`,
				hint: "Check that the workspace directory exists and is readable, or narrow --globs.",
			}),
	});
}

/** Outcome of a removal pass. */
export interface RemovalReport {
	readonly removed: ReadonlyArray<Target>;
	readonly failed: ReadonlyArray<FailedTarget>;
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

/** Split the comma-separated `--globs` value; fall back to defaults when empty. */
export function parseGlobs(raw: string): string[] {
	const parts = raw
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	return parts.length > 0 ? parts : DEFAULT_GLOBS;
}

/** One workspace's planned targets. */
interface Group {
	readonly name: string;
	readonly targets: ReadonlyArray<Target>;
}

/** What a removal pass did across every workspace. */
interface CleanOutcome {
	readonly total: number;
	readonly failures: ReadonlyArray<FailedTarget>;
}

/** A workspace's display name: its relative path, `<root>` for the root. */
const groupName = (relativePath: string): string => (relativePath === "." ? "<root>" : relativePath);

/**
 * One workspace's document: its name, then each removed target and each
 * failure. Only targets that actually succeeded are listed as removed (in a
 * dry run `removed` holds every target); a failure gets its own marker.
 */
const groupBlocks = (name: string, report: RemovalReport, dryRun: boolean): Array<Block> => {
	const verb = dryRun ? "would remove" : "removed";
	return [
		Report.line(""),
		Report.heading(name),
		...report.removed.map((t) => Report.detail(`${verb} [${t.kind}] ${t.path}`)),
		...report.failed.map((f) => Report.warn(`failed [${f.target.kind}] ${f.target.path}: ${f.reason}`)),
	];
};

/**
 * Remove each workspace's targets in order (leaves first, the root last),
 * calling `onStart` before and `onDone` after each workspace that has any.
 */
const removeGroups = <R>(
	groups: ReadonlyArray<Group>,
	dryRun: boolean,
	hooks: {
		readonly onStart: (group: Group) => Effect.Effect<void, never, R>;
		readonly onDone: (group: Group, report: RemovalReport) => Effect.Effect<void, never, R>;
	},
): Effect.Effect<CleanOutcome, never, R> =>
	Effect.gen(function* () {
		let total = 0;
		const failures: Array<FailedTarget> = [];
		for (const group of groups) {
			if (group.targets.length === 0) continue;
			yield* hooks.onStart(group);
			const report = yield* removeTargets(group.targets, dryRun);
			yield* hooks.onDone(group, report);
			total += report.removed.length;
			failures.push(...report.failed);
		}
		return { total, failures };
	});

/**
 * Discover packages, plan targets per workspace (leaves first, root last),
 * dedup across overlapping roots, remove (or preview), and report.
 *
 * @remarks
 * A person at a terminal (`CliInteractive`) watches a live progress view
 * whose committed frame is the summary — the counts and a table of anything
 * that could not be removed — with each workspace's document printed above
 * it as the workspace finishes. Every other run (an agent, CI, a pipe)
 * prints each workspace's document as it finishes and a one-line total, and
 * never loads Ink or React. Either way, targets that could not be removed
 * fail the run with a `CommandError` listing them.
 */
export function runClean(opts: {
	globs: string;
	dryRun: boolean;
}): Effect.Effect<void, CommandError, WorkspaceDiscovery | ReportEnv> {
	const patterns = parseGlobs(opts.globs);
	return Effect.gen(function* () {
		const discovery = yield* WorkspaceDiscovery;
		const packages = yield* discovery.listPackages().pipe(
			Effect.mapError((e) =>
				CommandError.from(e, {
					message: "could not discover the workspace packages",
					hint: "Run savvy clean from inside the workspace (a directory with pnpm-workspace.yaml or a workspaces field).",
				}),
			),
		);

		// Order: non-root packages (leaves) first, the root workspace last.
		const leaves = packages.filter((p) => !(p.relativePath === "."));
		const roots = packages.filter((p) => p.relativePath === ".");
		const ordered = [...leaves, ...roots];

		// Plan per workspace, then dedup paths globally in order so a path
		// matched under a leaf is not re-listed under the root.
		const planned = yield* Effect.forEach(ordered, (pkg) =>
			collectTargets(pkg.path, patterns).pipe(Effect.map((targets) => ({ pkg, targets }))),
		);
		const seen = new Set<string>();
		const groups: ReadonlyArray<Group> = planned.map(({ pkg, targets }) => ({
			name: groupName(pkg.relativePath),
			targets: targets.filter((t) => {
				if (seen.has(t.path)) return false;
				seen.add(t.path);
				return true;
			}),
		}));

		// Each workspace's document prints as it finishes, so a run that stops
		// part-way still shows what was already removed.
		const printGroup = (group: Group, report: RemovalReport) =>
			Report.print(groupBlocks(group.name, report, opts.dryRun));

		const outcome = (yield* CliInteractive)
			? yield* cleanLive(groups, opts.dryRun, printGroup)
			: yield* removeGroups(groups, opts.dryRun, { onStart: () => Effect.void, onDone: printGroup }).pipe(
					Effect.tap(({ total }) =>
						Report.print([Report.line(""), Report.ok(`${opts.dryRun ? "Would remove" : "Removed"} ${total} item(s)`)]),
					),
				);

		if (outcome.failures.length > 0) {
			return yield* Effect.fail(
				new CommandError({
					message: `${outcome.failures.length} target(s) could not be removed`,
					detail: outcome.failures.map((f) => `${f.target.path}: ${f.reason}`),
					hint: "Check the permissions on those paths and that no process holds them open, then re-run savvy clean.",
				}),
			);
		}
	});
}

/**
 * The removal pass under a live view, for a person at a terminal.
 *
 * @remarks
 * The view's module (the JSX) is imported here, on the one path that draws,
 * so no other run loads React. Every line the pass writes goes through the
 * view's `logConsole`, landing above the frame instead of tearing it.
 */
const cleanLive = <R>(
	groups: ReadonlyArray<Group>,
	dryRun: boolean,
	printGroup: (group: Group, report: RemovalReport) => Effect.Effect<void, never, R>,
): Effect.Effect<CleanOutcome, never, R | ReportEnv> =>
	Effect.scoped(
		Effect.gen(function* () {
			const { cleanView } = yield* Effect.promise(() => import("./clean/view.js"));
			const pubsub = yield* PubSub.unbounded<CleanEvent>();
			const events = yield* PubSub.subscribe(pubsub);
			const view = yield* CliUi.live({ ...cleanView, events });
			const workspaces = groups.filter((g) => g.targets.length > 0).length;
			yield* PubSub.publish(pubsub, { _tag: "Started", workspaces, dryRun });
			const outcome = yield* removeGroups(groups, dryRun, {
				onStart: (group) => PubSub.publish(pubsub, { _tag: "WorkspaceStarted", name: group.name }),
				onDone: (group, report) =>
					Effect.andThen(
						printGroup(group, report),
						PubSub.publish(pubsub, {
							_tag: "WorkspaceDone",
							name: group.name,
							removed: report.removed,
							failed: report.failed,
						}),
					),
			}).pipe(Effect.provideService(Console.Console, view.logConsole));
			yield* PubSub.publish(pubsub, { _tag: "Ended" });
			yield* view.close;
			return outcome;
		}),
	);

/* v8 ignore start -- CLI option/registration; orchestration tested via runClean */
const globsOption = Flag.String("globs").pipe(
	Flag.withAlias("g"),
	Flag.withDescription(
		`Comma-separated glob patterns to remove from each workspace root (default: ${DEFAULT_GLOBS.join(",")})`,
	),
	Flag.withDefault(DEFAULT_GLOBS.join(",")),
);

const dryRunOption = Flag.Boolean("dry-run").pipe(
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

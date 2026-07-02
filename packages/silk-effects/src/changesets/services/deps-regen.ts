/**
 * `Changesets.DepsRegen` service — lift the `deps regen` / `deps detect`
 * orchestration out of the CLI into a `Context.Tag` service with a
 * `plan()` / `execute()` split.
 *
 * @remarks
 * `plan()` computes the cumulative dependency diff (merge-base → working
 * tree by default, or between two explicit refs) by snapshotting both
 * sides through `PointInTimeWorkspace`, which resolves `catalog:` /
 * `workspace:` specifiers against each ref's own catalogs and package
 * versions before diffing. It drops `devDependency` rows (unless
 * `includeDevDeps`), and returns a complete {@link RegenPlan}
 * (target filenames + stale-changeset deletes) WITHOUT touching the
 * filesystem. `execute()` applies a plan — writing the fresh changesets
 * first, then deleting the stale pure-dependency ones (so an interrupted
 * run loses nothing and is safely re-runnable).
 *
 * This is the single source of truth for regen/detect: the CLI commands
 * and MCP tools are thin adapters over this service.
 *
 * @see {@link DepsRegen} for the service tag
 * @see {@link DepsRegenLive} for the production layer
 *
 */

import { join, resolve } from "node:path";
import type { CommandExecutor, Path } from "@effect/platform";
import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer, Option } from "effect";
import type { PointInTimeReadError, WorkspaceDiscoveryError } from "workspaces-effect";
import {
	PointInTimeWorkspace,
	PointInTimeWorkspaceLive,
	PublishabilityDetector,
	WorkspaceDiscovery,
	WorkspaceDiscoveryLive,
	WorkspaceRootLive,
} from "workspaces-effect";
import { ChangesetConfig, ChangesetConfigLive } from "../../services/ChangesetConfig.js";
import { ChangesetConfigReaderLive } from "../../services/ChangesetConfigReader.js";
import { PublishabilityDetectorAdaptiveLive } from "../../services/SilkPublishability.js";
import type { GitError } from "../errors.js";
import { ChangesetIOError } from "../errors.js";
import type { WorkspaceDependencyDiff } from "../utils/dep-diff.js";
import { computeWorkspaceDependencyDiffs } from "../utils/dep-diff.js";
import { serializeDependencyTableToMarkdown, sortDependencyRows } from "../utils/dependency-table.js";
import { gitMergeBase } from "../utils/git.js";
import { listPublishablePackageNames } from "../utils/publishability.js";
import { ConfigInspector, ConfigInspectorLive } from "./config-inspector.js";

/* ----------------------------------------------------------------- *
 * Changeset filename helpers (ported verbatim from the CLI command)
 * ----------------------------------------------------------------- */

const ADJECTIVES = ["brave", "clever", "swift", "silver", "lucky", "happy", "calm", "bright", "quiet", "wild"] as const;
const NOUNS = ["dogs", "cats", "wolves", "foxes", "cups", "ships", "trees", "owls", "cranes", "hills"] as const;
const VERBS = ["laugh", "dream", "fly", "sing", "dance", "wander", "soar", "rest", "leap", "ponder"] as const;

function pickRandomTriplet(): string {
	const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] as string;
	const n = NOUNS[Math.floor(Math.random() * NOUNS.length)] as string;
	const v = VERBS[Math.floor(Math.random() * VERBS.length)] as string;
	return `${a}-${n}-${v}`;
}

/**
 * Pick a `<adjective>-<noun>-<verb>` filename slug that does not collide
 * with an existing `.changeset/*.md` OR with a slug already claimed
 * earlier in the same {@link RegenPlan.toWrite} computation. `plan()`
 * never writes to disk, so an on-disk existence check alone cannot see
 * slugs chosen moments earlier in the same call — the `chosen` set closes
 * that gap. The triplet space is 1,000 combinations, so a busy repo can
 * plausibly exhaust it across runs; fall back to a timestamp suffix after
 * 20 unlucky picks.
 *
 * @param fileExists - Effectful on-disk existence check (never fails; a
 *   filesystem error is treated as "does not exist" so filename selection
 *   degrades gracefully rather than blocking the plan).
 * @param changesetDir - Directory checked for on-disk collisions.
 * @param chosen - Basenames (without extension) already picked within this plan;
 *   the picked candidate is added to this set before returning.
 * @internal
 */
function randomFilename(
	fileExists: (path: string) => Effect.Effect<boolean>,
	changesetDir: string,
	chosen: Set<string>,
): Effect.Effect<string> {
	return Effect.gen(function* () {
		for (let i = 0; i < 20; i++) {
			const candidate = pickRandomTriplet();
			if (!chosen.has(candidate) && !(yield* fileExists(join(changesetDir, `${candidate}.md`)))) {
				chosen.add(candidate);
				return candidate;
			}
		}
		// Timestamp fallback after 20 unlucky triplet picks. Loop until the name is
		// unique against both the on-disk changesets and the slugs already chosen in
		// this plan, so two packages exhausting the triplet space in the same
		// millisecond cannot resolve to the same file.
		let attempt = 0;
		let fallback = `${pickRandomTriplet()}-${Date.now()}`;
		while (chosen.has(fallback) || (yield* fileExists(join(changesetDir, `${fallback}.md`)))) {
			fallback = `${pickRandomTriplet()}-${Date.now()}-${++attempt}`;
		}
		chosen.add(fallback);
		return fallback;
	});
}

/**
 * Strict detection of "pure dependency changesets" per the documented
 * rules: single-package frontmatter, single `## Dependencies` heading,
 * no other body content beyond that section.
 *
 * @param content - Raw `.changeset/*.md` file contents.
 * @returns `{ isPure, package }` — `isPure` is `true` only for a
 *   single-package, Dependencies-only changeset; `package` is the sole
 *   frontmatter package name (or `null` when not pure).
 *
 * @public
 */
export function isPureDependencyChangeset(content: string): { isPure: boolean; package: string | null } {
	// Split frontmatter from body.
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!fmMatch) return { isPure: false, package: null };
	const frontmatter = fmMatch[1] as string;
	const body = (fmMatch[2] ?? "").trim();

	// Parse single-package frontmatter — accepts `"@pkg": bump` lines only.
	const fmLines = frontmatter.split(/\r?\n/).filter((l) => l.trim().length > 0 && !/^\s*#/.test(l));
	if (fmLines.length !== 1) return { isPure: false, package: null };
	const pkgLine = fmLines[0] as string;
	const pkgMatch = pkgLine.match(/^\s*["']?([^"':\s]+)["']?\s*:\s*([a-z]+)\s*$/);
	if (!pkgMatch) return { isPure: false, package: null };
	const pkg = pkgMatch[1] as string;

	// Body must start with `## Dependencies` (allow leading blank lines).
	const bodyTrimmed = body.replace(/^\s+/, "");
	if (!/^## Dependencies\b/.test(bodyTrimmed)) return { isPure: false, package: null };

	// Body must contain no other `##` headings.
	const h2Matches = bodyTrimmed.match(/^## /gm) ?? [];
	if (h2Matches.length !== 1) return { isPure: false, package: null };

	// Body must contain no `#` headings.
	if (/^# /m.test(bodyTrimmed)) return { isPure: false, package: null };

	return { isPure: true, package: pkg };
}

/**
 * List `.changeset/*.md` files (excluding `README.md`) in `changesetDir`.
 * A missing directory is today's behavior for "no changesets yet" and
 * resolves to an empty list; any OTHER failure (e.g. a directory that
 * exists but cannot be read) is a loud {@link ChangesetIOError} — an
 * unreadable `.changeset` dir must not silently masquerade as "no
 * changesets".
 */
const listChangesetFiles = (
	fs: FileSystem.FileSystem,
	changesetDir: string,
): Effect.Effect<ReadonlyArray<string>, ChangesetIOError> =>
	fs.readDirectory(changesetDir).pipe(
		Effect.map((names) =>
			names.filter((f) => f.endsWith(".md") && f !== "README.md").map((f) => join(changesetDir, f)),
		),
		Effect.catchAll((e) =>
			e._tag === "SystemError" && e.reason === "NotFound"
				? Effect.succeed([] as ReadonlyArray<string>)
				: Effect.fail(new ChangesetIOError({ path: changesetDir, operation: "list", reason: String(e) })),
		),
	);

/**
 * Pure-dependency changesets found in `changesetDir`. An individual file
 * that cannot be read (e.g. removed mid-scan, permission race) is skipped —
 * today's semantics — while a failure to list the directory itself
 * propagates as a loud {@link ChangesetIOError}.
 */
const findPureDependencyChangesets = (
	fs: FileSystem.FileSystem,
	changesetDir: string,
): Effect.Effect<ReadonlyArray<{ readonly file: string; readonly package: string }>, ChangesetIOError> =>
	Effect.gen(function* () {
		const files = yield* listChangesetFiles(fs, changesetDir);
		const result: Array<{ file: string; package: string }> = [];
		for (const file of files) {
			const content = yield* fs.readFileString(file).pipe(Effect.option);
			if (Option.isNone(content)) continue;
			const detection = isPureDependencyChangeset(content.value);
			if (detection.isPure && detection.package) {
				result.push({ file, package: detection.package });
			}
		}
		return result;
	});

/**
 * Mixed dependency changesets (have a `## Dependencies` heading but fail
 * the strict pure-changeset test) found in `changesetDir`. Same
 * skip-unreadable-file / loud-list-failure semantics as
 * {@link findPureDependencyChangesets}.
 */
const findMixedDependencyChangesets = (
	fs: FileSystem.FileSystem,
	changesetDir: string,
): Effect.Effect<ReadonlyArray<string>, ChangesetIOError> =>
	Effect.gen(function* () {
		const files = yield* listChangesetFiles(fs, changesetDir);
		const result: string[] = [];
		for (const file of files) {
			const content = yield* fs.readFileString(file).pipe(Effect.option);
			if (Option.isNone(content)) continue;
			// Mixed = has a `## Dependencies` heading but doesn't pass the strict test.
			if (/^## Dependencies\b/m.test(content.value) && !isPureDependencyChangeset(content.value).isPure) {
				result.push(file);
			}
		}
		return result;
	});

/**
 * Render a single-package, patch-bump changeset for a diff whose rows are
 * already resolved (per-side, inside {@link computeWorkspaceDependencyDiffs})
 * and devDep-filtered.
 */
function renderChangesetContent(diff: WorkspaceDependencyDiff): string {
	const frontmatter = `---\n"${diff.package}": patch\n---`;
	const table = serializeDependencyTableToMarkdown([...diff.rows]);
	return `${frontmatter}\n\n## Dependencies\n\n${table}\n`;
}

/* ----------------------------------------------------------------- *
 * Plan / result shapes
 * ----------------------------------------------------------------- */

/**
 * A complete, side-effect-free regen plan: which stale pure-dependency
 * changesets to delete, which fresh changesets to write (carrying the
 * already-resolved diff), and which mixed changesets were left untouched.
 *
 * @public
 */
export interface RegenPlan {
	readonly toDelete: ReadonlyArray<{ readonly file: string; readonly package: string }>;
	readonly toWrite: ReadonlyArray<{
		readonly file: string;
		readonly package: string;
		readonly diff: WorkspaceDependencyDiff;
	}>;
	readonly skippedMixed: ReadonlyArray<string>;
}

/**
 * The result of applying a {@link RegenPlan}: the files actually deleted
 * and written, plus the mixed changesets that were skipped.
 *
 * @public
 */
export interface RegenResult {
	readonly deleted: ReadonlyArray<string>;
	readonly written: ReadonlyArray<string>;
	readonly skippedMixed: ReadonlyArray<string>;
}

/**
 * Options for {@link DepsRegenShape.plan}.
 *
 * @public
 */
export interface DepsRegenOptions {
	/** Project root (containing `.changeset/`). */
	readonly cwd: string;
	/** Override the base branch used to compute the merge-base when `from` is omitted. */
	readonly base?: string;
	/** Restrict regeneration to a single workspace package. */
	readonly package?: string;
	/**
	 * When `true`, retain `devDependency` rows (the `deps detect` path);
	 * when falsy (the `deps regen` default), drop them unconditionally.
	 * Protocol resolution runs regardless.
	 */
	readonly includeDevDeps?: boolean;
	/**
	 * Older ref to diff from. Defaults to `git merge-base <base branch> HEAD`.
	 */
	readonly from?: string;
	/**
	 * Newer ref to diff to. Defaults to the working tree (staged + unstaged
	 * + untracked) via `PointInTimeWorkspace.worktree`.
	 */
	readonly to?: string;
}

/**
 * Effect service interface for the deps regen/detect orchestration.
 *
 * @public
 */
export interface DepsRegenShape {
	/**
	 * Compute a complete {@link RegenPlan}. Read-only against the filesystem:
	 * only inspects the existing `.changeset/*.md` files to detect
	 * stale/mixed changesets.
	 *
	 * @param options - See {@link DepsRegenOptions}.
	 * @returns An Effect yielding the plan, or failing with {@link GitError},
	 *   `WorkspaceDiscoveryError`, {@link ChangesetIOError} (an unreadable
	 *   `.changeset` directory or a genuinely unreadable changeset file list),
	 *   or `PointInTimeReadError` (a snapshot read failed for either ref).
	 */
	readonly plan: (
		options: DepsRegenOptions,
	) => Effect.Effect<RegenPlan, GitError | WorkspaceDiscoveryError | ChangesetIOError | PointInTimeReadError, never>;
	/**
	 * Apply a {@link RegenPlan}: write fresh changesets first, then delete
	 * stale ones. Writes fail loudly with {@link ChangesetIOError}; deletion
	 * failures are tolerated (skip-and-continue) so an interrupted run stays
	 * safely re-runnable.
	 *
	 * @param plan - The plan produced by {@link DepsRegenShape.plan}.
	 * @returns An Effect yielding a {@link RegenResult}.
	 */
	readonly execute: (plan: RegenPlan) => Effect.Effect<RegenResult, ChangesetIOError, never>;
}

const _tag = Context.Tag("Changesets/DepsRegen");

/**
 * @internal
 */
export const DepsRegenBase = _tag<DepsRegen, DepsRegenShape>();

/**
 * Effect service tag for {@link DepsRegenShape}.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { Changesets } from "@savvy-web/silk-effects";
 *
 * const program = Effect.gen(function* () {
 *   const svc = yield* Changesets.DepsRegen;
 *   const plan = yield* svc.plan({ cwd: process.cwd() });
 *   return yield* svc.execute(plan);
 * });
 * ```
 *
 * @public
 */
export class DepsRegen extends DepsRegenBase {}

/* ----------------------------------------------------------------- *
 * Live layer
 * ----------------------------------------------------------------- */

/**
 * Build a {@link DepsRegenShape} that closes over already-resolved service
 * implementations, keeping the public `plan`/`execute` signatures
 * requirement-free (`R = never`).
 */
function makeShape(
	pit: typeof PointInTimeWorkspace.Service,
	inspector: typeof ConfigInspector.Service,
	discovery: typeof WorkspaceDiscovery.Service,
	detector: typeof PublishabilityDetector.Service,
	config: typeof ChangesetConfig.Service,
	fs: FileSystem.FileSystem,
): DepsRegenShape {
	const provideDetector = Layer.succeed(PublishabilityDetector, detector);
	const fileExists = (p: string): Effect.Effect<boolean> => fs.exists(p).pipe(Effect.orElseSucceed(() => false));

	const plan = (
		options: DepsRegenOptions,
	): Effect.Effect<RegenPlan, GitError | WorkspaceDiscoveryError | ChangesetIOError | PointInTimeReadError, never> =>
		Effect.gen(function* () {
			const resolvedCwd = resolve(options.cwd);
			const changesetDir = join(resolvedCwd, ".changeset");

			// Resolve the "from" ref — explicit `from`, else merge-base with the
			// (possibly overridden) base branch.
			let fromRef = options.from;
			if (!fromRef) {
				let baseBranch = options.base;
				if (!baseBranch) {
					const inspected = yield* inspector
						.inspect(resolvedCwd)
						.pipe(
							Effect.catchTag("ConfigurationError", () =>
								Effect.succeed({ baseBranch: "main" } as { baseBranch: string }),
							),
						);
					baseBranch = inspected.baseBranch;
				}
				fromRef = yield* gitMergeBase(resolvedCwd, baseBranch);
			}

			// Snapshots: before = from ref, after = to ref (or working tree). Each
			// side carries its own catalogs and package versions, so rows leave the
			// diff already resolved.
			const before = yield* pit.at(fromRef, { cwd: resolvedCwd });
			const after = options.to
				? yield* pit.at(options.to, { cwd: resolvedCwd })
				: yield* pit.worktree({ cwd: resolvedCwd });

			const rawDiffs = computeWorkspaceDependencyDiffs(before, after);
			const targetPkg = options.package;

			// In-scope package set — "versionable minus ignored" — used both to
			// filter diffs (absent an explicit `--package`) and to bound
			// stale-changeset deletion. A package is versionable when it is
			// publishable OR covered by `privatePackages.version`; the changeset
			// ignore list wins over both. Do NOT swallow a genuine discovery
			// failure — a malformed workspace must surface as an error rather
			// than masquerade as "no packages publishable" (which would silently
			// produce an empty plan).
			const livePackages = yield* discovery.listPackages(resolvedCwd);
			const publishable = yield* listPublishablePackageNames(livePackages, resolvedCwd).pipe(
				Effect.provide(provideDetector),
			);
			const versionPrivate = yield* config.versionPrivate(resolvedCwd);

			const inScope = new Set<string>();
			for (const pkg of livePackages) {
				if (yield* config.isIgnored(pkg.name, resolvedCwd)) continue;
				if (publishable.has(pkg.name) || versionPrivate) inScope.add(pkg.name);
			}
			// Explicit `--package` bypasses the versionable half but NOT ignore: an
			// ignored target package produces an empty plan for it.
			const targetIgnored = targetPkg ? yield* config.isIgnored(targetPkg, resolvedCwd) : false;

			// Restrict, then drop devDeps (unless kept), then drop diffs whose rows
			// became empty. Specifier resolution already happened per-side inside
			// computeWorkspaceDependencyDiffs, so rows arrive fully resolved.
			const keepDevDeps = options.includeDevDeps === true;
			const scoped = targetPkg
				? targetIgnored
					? []
					: rawDiffs.filter((d) => d.package === targetPkg)
				: rawDiffs.filter((d) => inScope.has(d.package));

			const resolved: WorkspaceDependencyDiff[] = [];
			for (const diff of scoped) {
				const rows = keepDevDeps ? [...diff.rows] : diff.rows.filter((r) => r.type !== "devDependency");
				if (rows.length > 0) resolved.push({ ...diff, rows: sortDependencyRows(rows) });
			}

			const existingPure = yield* findPureDependencyChangesets(fs, changesetDir);
			const skippedMixed = yield* findMixedDependencyChangesets(fs, changesetDir);

			// When `--package` is set, only delete pure changesets for that package
			// (unless ignored); otherwise delete pure-dep changesets for every
			// in-scope package — even stale ones with no current dep changes.
			const toDelete = targetPkg
				? targetIgnored
					? []
					: existingPure.filter((p) => p.package === targetPkg)
				: existingPure.filter((p) => inScope.has(p.package));

			const chosenFilenames = new Set<string>();
			const toWrite: Array<{ file: string; package: string; diff: WorkspaceDependencyDiff }> = [];
			for (const diff of resolved) {
				const filename = yield* randomFilename(fileExists, changesetDir, chosenFilenames);
				toWrite.push({ file: join(changesetDir, `${filename}.md`), package: diff.package, diff });
			}

			return { toDelete, toWrite, skippedMixed };
		});

	const execute = (plan: RegenPlan): Effect.Effect<RegenResult, ChangesetIOError, never> =>
		Effect.gen(function* () {
			const deleted: string[] = [];
			const written: string[] = [];
			// Write the fresh changesets first, then remove the stale ones. Fresh
			// filenames never collide with existing files (randomFilename checks
			// on-disk existence), so an interrupted write leaves every stale
			// changeset in place — nothing is lost and the run is safely
			// re-runnable. Writes fail loudly; deletes are tolerant.
			for (const entry of plan.toWrite) {
				yield* fs
					.writeFileString(entry.file, renderChangesetContent(entry.diff))
					.pipe(
						Effect.mapError((e) => new ChangesetIOError({ path: entry.file, operation: "write", reason: String(e) })),
					);
				written.push(entry.file);
			}
			for (const entry of plan.toDelete) {
				// Tolerant: missing or undeletable stale changesets are skipped.
				const removed = yield* Effect.isSuccess(fs.remove(entry.file));
				if (removed) deleted.push(entry.file);
			}
			return { deleted, written, skippedMixed: plan.skippedMixed };
		});

	return { plan, execute };
}

/**
 * Live layer for {@link DepsRegen}.
 *
 * Requires `PointInTimeWorkspace`, `WorkspaceDiscovery`,
 * `PublishabilityDetector` (all from `workspaces-effect`),
 * {@link ConfigInspector}, {@link ChangesetConfig}, and
 * `FileSystem.FileSystem` (resolved once at construction and closed over by
 * the shape, keeping `plan`/`execute` themselves requirement-free).
 *
 * @public
 */
export const DepsRegenLive: Layer.Layer<
	DepsRegen,
	never,
	| PointInTimeWorkspace
	| ConfigInspector
	| WorkspaceDiscovery
	| PublishabilityDetector
	| ChangesetConfig
	| FileSystem.FileSystem
> = Layer.effect(
	DepsRegen,
	Effect.gen(function* () {
		const pit = yield* PointInTimeWorkspace;
		const inspector = yield* ConfigInspector;
		const discovery = yield* WorkspaceDiscovery;
		const detector = yield* PublishabilityDetector;
		const config = yield* ChangesetConfig;
		const fs = yield* FileSystem.FileSystem;
		return makeShape(pit, inspector, discovery, detector, config, fs);
	}),
);

/* ----------------------------------------------------------------- *
 * Batteries-included default layer
 * ----------------------------------------------------------------- */

// Shared sub-graphs — single const per layer value so Layer memoization
// (by reference) constructs each service exactly once across the branches
// below, rather than once per branch that needs it.
const WorkspaceGraph = Layer.mergeAll(WorkspaceRootLive, WorkspaceDiscoveryLive.pipe(Layer.provide(WorkspaceRootLive)));
const ConfigGraph = ChangesetConfigLive.pipe(Layer.provide(ChangesetConfigReaderLive));

/**
 * Batteries-included {@link DepsRegen} layer: silk's opinionated default
 * composition of the full dependency graph. Only the platform services
 * remain — note that {@link PointInTimeWorkspace} reads git history, so
 * this layer genuinely requires `CommandExecutor` in addition to
 * `FileSystem`/`Path`: provide a git-capable platform layer
 * (`NodeContext.layer`), not a bare filesystem-only layer.
 *
 * Gating uses silk's adaptive publishability detector
 * ({@link PublishabilityDetectorAdaptiveLive}), so the default semantics
 * are "versionable minus ignored" — identical to the savvy CLI and MCP
 * runtimes. Consumers who need to swap any dependency (test detectors,
 * alternate config sources) should keep composing {@link DepsRegenLive}
 * directly; this layer is purely additive.
 *
 * @example
 * ```typescript
 * import { NodeContext } from "@effect/platform-node";
 * import { Layer } from "effect";
 * import { Changesets } from "@savvy-web/silk-effects";
 *
 * const depsRegen = Changesets.DepsRegenDefault.pipe(Layer.provide(NodeContext.layer));
 * ```
 *
 * @public
 */
export const DepsRegenDefault: Layer.Layer<
	DepsRegen,
	never,
	FileSystem.FileSystem | Path.Path | CommandExecutor.CommandExecutor
> = DepsRegenLive.pipe(
	Layer.provide(PointInTimeWorkspaceLive.pipe(Layer.provide(WorkspaceGraph))),
	Layer.provide(ConfigInspectorLive.pipe(Layer.provide(Layer.mergeAll(ChangesetConfigReaderLive, WorkspaceGraph)))),
	Layer.provide(PublishabilityDetectorAdaptiveLive.pipe(Layer.provide(ConfigGraph))),
	Layer.provide(ConfigGraph),
	Layer.provide(WorkspaceGraph),
);

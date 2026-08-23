/**
 * `Changesets.DepsRegen` service — lift the `deps regen` / `deps detect`
 * orchestration out of the CLI into a `Context.Service` with a
 * `plan()` / `execute()` split.
 *
 * @remarks
 * `plan()` computes the cumulative dependency diff (merge-base → working
 * tree by default, or between two explicit refs) by snapshotting both
 * sides through `@effected/workspaces`' `WorkspaceSnapshots`, which
 * resolves `catalog:` / `workspace:` specifiers against each ref's own
 * catalogs and package versions before diffing. It drops `devDependency`
 * rows (unless `includeDevDeps`), and returns a complete {@link RegenPlan}
 * (target filenames + stale-changeset deletes) WITHOUT touching the
 * filesystem. `execute()` applies a plan — writing the fresh changesets
 * first, then deleting the stale pure-dependency ones (so an interrupted
 * run loses nothing and is safely re-runnable).
 *
 * A pure dependency changeset is only ever a delete candidate when BOTH:
 * its package is in scope AND actually produced a fresh diff this run
 * (present in {@link RegenPlan.toWrite}), and the file was authored on
 * this branch rather than already committed at the merge-base ref. Either
 * gap silently destroyed a still-relevant release note before this was
 * fixed (#258) — a devDependency-only diff drops all its rows and was
 * never rewritten, and a changeset an earlier, already-merged PR
 * committed was swept away by an unrelated branch's regen run.
 *
 * This is the single source of truth for regen/detect: the CLI commands
 * and MCP tools are thin adapters over this service.
 *
 * @see {@link DepsRegen} for the service tag
 *
 */

import { basename, join, resolve } from "node:path";
import { Git } from "@effected/git";
import type {
	PublishabilityDetectorShape,
	WorkspaceDiscoveryFailure,
	WorkspaceDiscoveryShape,
	WorkspaceSnapshotAtFailure,
	WorkspaceSnapshotWorktreeFailure,
	WorkspaceSnapshotsShape,
	WorkspacesOptions,
} from "@effected/workspaces";
import { PublishabilityDetector, WorkspaceDiscovery, WorkspaceSnapshots, Workspaces } from "@effected/workspaces";
import type { Path } from "effect";
import { Context, Effect, FileSystem, Layer, Option } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ChangesetConfigShape } from "../../services/ChangesetConfig.js";
import { ChangesetConfig } from "../../services/ChangesetConfig.js";
import { ChangesetConfigReader } from "../../services/ChangesetConfigReader.js";
import { SilkPublishability } from "../../services/SilkPublishability.js";
import type { GitError } from "../errors.js";
import { ChangesetIOError } from "../errors.js";
import type { WorkspaceDependencyDiff } from "../utils/dep-diff.js";
import { computeWorkspaceDependencyDiffs } from "../utils/dep-diff.js";
import { serializeDependencyTableToMarkdown, sortDependencyRows } from "../utils/dependency-table.js";
import { gitListChangesetFilesAtRef, gitMergeBase } from "../utils/git.js";
import { listPublishablePackageNames } from "../utils/publishability.js";
import type { ConfigInspectorShape } from "./config-inspector.js";
import { ConfigInspector } from "./config-inspector.js";

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
		Effect.catch((e) =>
			// v4 FileSystem failures arrive as PlatformError wrapping a SystemError
			// whose _tag carries the normalized reason ("NotFound" et al.).
			e._tag === "PlatformError" && e.reason._tag === "NotFound"
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
 * Every package name a changeset's YAML frontmatter releases, parsed with the
 * same lenient `"@pkg": bump` line grammar {@link isPureDependencyChangeset}
 * uses. A file with no frontmatter, or one whose lines all fail the grammar,
 * yields an empty list — this feeds an informational surface, so lenient
 * degradation beats a typed failure.
 *
 * @param content - Raw `.changeset/*.md` file contents.
 *
 * @public
 */
export function parseChangesetPackages(content: string): ReadonlyArray<string> {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return [];
	const packages: string[] = [];
	for (const line of (fmMatch[1] as string).split(/\r?\n/)) {
		if (line.trim().length === 0 || /^\s*#/.test(line)) continue;
		const m = line.match(/^\s*["']?([^"':\s]+)["']?\s*:\s*([a-z]+)\s*$/);
		if (m) packages.push(m[1] as string);
	}
	return packages;
}

/**
 * Whether `content` carries a `## Dependencies` heading OUTSIDE fenced code
 * blocks. A prose changeset that DOCUMENTS the changeset format quotes the
 * heading inside a ``` fence; a fence-blind regex misreads that file as a
 * dependency changeset (classified mixed, dropped from the coexisting
 * bucket). Tracks CommonMark fence state: an opening run of 3+ backticks or
 * tildes (a backtick fence's info string may not contain a backtick) is
 * closed only by a run of the same character, at least as long, with nothing
 * else on the line.
 */
function containsDependenciesHeading(content: string): boolean {
	let fence: { readonly char: string; readonly length: number } | null = null;
	for (const line of content.split(/\r?\n/)) {
		const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
		if (match) {
			const run = match[1] as string;
			const char = run.charAt(0);
			const trailing = match[2] as string;
			if (fence === null) {
				if (char === "~" || !trailing.includes("`")) {
					fence = { char, length: run.length };
					continue;
				}
			} else if (char === fence.char && run.length >= fence.length && trailing.trim() === "") {
				fence = null;
				continue;
			}
		}
		if (fence === null && /^## Dependencies\b/.test(line)) return true;
	}
	return false;
}

/**
 * Prose-only changesets (no `## Dependencies` heading at all) found in
 * `changesetDir`, each with the packages its frontmatter releases. These are
 * the files a regen run never touches — surfaced so the result can account
 * for them instead of leaving them invisible (#279). Same
 * skip-unreadable-file / loud-list-failure semantics as
 * {@link findPureDependencyChangesets}.
 */
const findProseChangesets = (
	fs: FileSystem.FileSystem,
	changesetDir: string,
): Effect.Effect<
	ReadonlyArray<{ readonly file: string; readonly packages: ReadonlyArray<string> }>,
	ChangesetIOError
> =>
	Effect.gen(function* () {
		const files = yield* listChangesetFiles(fs, changesetDir);
		const result: Array<{ file: string; packages: ReadonlyArray<string> }> = [];
		for (const file of files) {
			const content = yield* fs.readFileString(file).pipe(Effect.option);
			if (Option.isNone(content)) continue;
			// Prose-only = no Dependencies heading anywhere (outside code fences).
			// Pure and mixed dependency changesets are already accounted for by
			// the other buckets.
			if (containsDependenciesHeading(content.value)) continue;
			result.push({ file, packages: parseChangesetPackages(content.value) });
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
			// Mixed = has a `## Dependencies` heading (outside code fences) but
			// doesn't pass the strict test.
			if (containsDependenciesHeading(content.value) && !isPureDependencyChangeset(content.value).isPure) {
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
 * A prose-only changeset that coexists with the run: it releases at least one
 * package in scope for this run but was left untouched because it carries no
 * `## Dependencies` section. Purely informational (#279) — surfaced so the
 * regen/detect result accounts for every changeset touching an in-scope
 * package, instead of leaving prose entries invisible and forcing a manual
 * `.changeset/` cross-check.
 *
 * @public
 */
export interface CoexistingChangeset {
	/** Absolute path of the untouched prose changeset. */
	readonly file: string;
	/** The in-scope packages its frontmatter releases (out-of-scope names are dropped). */
	readonly packages: ReadonlyArray<string>;
}

/**
 * A complete, side-effect-free regen plan: which stale pure-dependency
 * changesets to delete, which fresh changesets to write (carrying the
 * already-resolved diff), which mixed changesets were left untouched, and
 * which coexisting prose changesets reference in-scope packages.
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
	/** Informational: untouched prose changesets releasing in-scope packages (#279). */
	readonly coexisting: ReadonlyArray<CoexistingChangeset>;
}

/**
 * The result of applying a {@link RegenPlan}: the files actually deleted
 * and written, plus the mixed changesets that were skipped and the
 * coexisting prose changesets carried through from the plan.
 *
 * @public
 */
export interface RegenResult {
	readonly deleted: ReadonlyArray<string>;
	readonly written: ReadonlyArray<string>;
	readonly skippedMixed: ReadonlyArray<string>;
	/** Informational: untouched prose changesets releasing in-scope packages (#279). */
	readonly coexisting: ReadonlyArray<CoexistingChangeset>;
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
	/** Restrict regeneration to a single workspace package. Unioned with {@link DepsRegenOptions.packages}. */
	readonly package?: string;
	/**
	 * Restrict regeneration to these workspace packages. Like `package`, an
	 * explicit target bypasses the versionable gate but NOT the changeset
	 * ignore list. Unioned with `package` when both are set.
	 */
	readonly packages?: ReadonlyArray<string>;
	/**
	 * Drop these packages from scope entirely — no changesets are written for
	 * them and none of their stale pure-dependency changesets are deleted.
	 * Applies to both repo-wide and explicitly-targeted runs (exclude wins).
	 */
	readonly exclude?: ReadonlyArray<string>;
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
	 * + untracked) via `WorkspaceSnapshots.worktree`.
	 */
	readonly to?: string;
}

/**
 * Every failure {@link DepsRegenShape.plan} can surface: this package's
 * {@link GitError} (merge-base resolution) and {@link ChangesetIOError}
 * (an unreadable `.changeset` directory), plus `@effected/workspaces`'
 * typed discovery and snapshot failures (a snapshot read failing for
 * either ref, a catalog-assembly failure, or an unfindable root).
 *
 * @public
 */
export type DepsRegenPlanError =
	| GitError
	| ChangesetIOError
	| WorkspaceDiscoveryFailure
	| WorkspaceSnapshotAtFailure
	| WorkspaceSnapshotWorktreeFailure;

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
	 * @returns An Effect yielding the plan, or failing with
	 *   {@link DepsRegenPlanError}.
	 */
	readonly plan: (options: DepsRegenOptions) => Effect.Effect<RegenPlan, DepsRegenPlanError, never>;
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
export class DepsRegen extends Context.Service<DepsRegen, DepsRegenShape>()("Changesets/DepsRegen") {
	/**
	 * Production layer for {@link DepsRegen}.
	 *
	 * Requires `WorkspaceSnapshots`, `WorkspaceDiscovery`,
	 * `PublishabilityDetector` (all from `@effected/workspaces`),
	 * `Git` (from `@effected/git`, backing merge-base resolution),
	 * {@link ConfigInspector}, {@link ChangesetConfig}, and
	 * `FileSystem.FileSystem` (resolved once at construction and closed over by
	 * the shape, keeping `plan`/`execute` themselves requirement-free).
	 *
	 * @public
	 */
	static readonly layer: Layer.Layer<
		DepsRegen,
		never,
		| WorkspaceSnapshots
		| ConfigInspector
		| WorkspaceDiscovery
		| PublishabilityDetector
		| ChangesetConfig
		| Git
		| FileSystem.FileSystem
	> = Layer.effect(
		this,
		Effect.gen(function* () {
			const snapshots = yield* WorkspaceSnapshots;
			const inspector = yield* ConfigInspector;
			const discovery = yield* WorkspaceDiscovery;
			const detector = yield* PublishabilityDetector;
			const config = yield* ChangesetConfig;
			const fs = yield* FileSystem.FileSystem;
			const git = yield* Git;
			return makeShape(snapshots, inspector, discovery, detector, config, fs, Layer.succeed(Git, git));
		}),
	);
}

/* ----------------------------------------------------------------- *
 * Batteries-included default layer
 * ----------------------------------------------------------------- */

/**
 * Build a {@link DepsRegenShape} that closes over already-resolved service
 * implementations, keeping the public `plan`/`execute` signatures
 * requirement-free (`R = never`).
 */
function makeShape(
	snapshots: WorkspaceSnapshotsShape,
	inspector: ConfigInspectorShape,
	discovery: WorkspaceDiscoveryShape,
	detector: PublishabilityDetectorShape,
	config: ChangesetConfigShape,
	fs: FileSystem.FileSystem,
	provideGit: Layer.Layer<Git>,
): DepsRegenShape {
	const provideDetector = Layer.succeed(PublishabilityDetector, detector);
	const fileExists = (p: string): Effect.Effect<boolean> => fs.exists(p).pipe(Effect.orElseSucceed(() => false));

	const plan = (options: DepsRegenOptions): Effect.Effect<RegenPlan, DepsRegenPlanError, never> =>
		Effect.gen(function* () {
			const resolvedCwd = resolve(options.cwd);
			const changesetDir = join(resolvedCwd, ".changeset");

			// WorkspaceDiscovery caches listPackages per root for the layer
			// lifetime, and Effect memoizes the discovery layer by reference across
			// composition branches — so in a process that enumerated the workspace
			// BEFORE manifests were edited (an updater tool's natural flow), every
			// workspace read below — the ConfigInspector fallback, the worktree
			// snapshot, and the versionable gating — would be served the pre-edit
			// manifests and the diff would silently collapse to a no-op. A plan
			// must read the workspace as it is now: drop the cache first.
			//
			// ConfigInspector and ChangesetConfig carry their own per-root caches
			// with no self-expiry (#229) - a long-lived process such as the
			// savvy-mcp server holds one DepsRegen for its whole lifetime, so an
			// edit to .changeset/config.json made between two plan() calls (a
			// changed ignore list, privatePackages setting, or baseBranch) would
			// otherwise be invisible for the rest of the process.
			// inspector.refresh() also refreshes WorkspaceDiscovery, so this one
			// call covers both. Deliberately the WHOLESALE refresh, not the
			// per-root refreshIn: plan() reads through the LAYER-BOUND
			// `discovery.listPackages()` and worktree snapshot below, and the
			// kit's per-root refresh leaves the layer-bound memo untouched by
			// contract — a per-root refresh here would reintroduce the stale
			// enumeration this refresh exists to prevent.
			yield* inspector.refresh();
			yield* config.refresh();

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
				fromRef = yield* gitMergeBase(resolvedCwd, baseBranch).pipe(Effect.provide(provideGit));
			}

			// Snapshots: before = from ref, after = to ref (or working tree). Each
			// side carries its own catalogs and package versions, so rows leave the
			// diff already resolved. The kit's WorkspaceSnapshots resolves its root
			// from the layer it was built with (`{ cwd }` option) — single-root by
			// design, so `options.cwd` must sit inside that workspace.
			const before = yield* snapshots.at(fromRef);
			const after = options.to ? yield* snapshots.at(options.to) : yield* snapshots.worktree();

			const rawDiffs = computeWorkspaceDependencyDiffs(before, after);
			const explicitTargets = new Set<string>([
				...(options.packages ?? []),
				...(options.package ? [options.package] : []),
			]);
			const excluded = new Set(options.exclude ?? []);

			// In-scope package set — "versionable minus ignored" — used both to
			// filter diffs (absent an explicit `--package`) and to bound
			// stale-changeset deletion. A package is versionable when it is
			// publishable OR covered by `privatePackages.version`; the changeset
			// ignore list wins over both. Do NOT swallow a genuine discovery
			// failure — a malformed workspace must surface as an error rather
			// than masquerade as "no packages publishable" (which would silently
			// produce an empty plan).
			const livePackages = yield* discovery.listPackages();
			const publishable = yield* listPublishablePackageNames(livePackages, resolvedCwd).pipe(
				Effect.provide(provideDetector),
			);
			const versionPrivate = yield* config.versionPrivate(resolvedCwd);

			const inScope = new Set<string>();
			for (const pkg of livePackages) {
				if (yield* config.isIgnored(pkg.name, resolvedCwd)) continue;
				if (publishable.has(pkg.name) || versionPrivate) inScope.add(pkg.name);
			}
			// Explicit targets (`--package` / `packages`) bypass the versionable half
			// but NOT ignore: an ignored target package produces an empty plan for
			// it. `exclude` wins over everything.
			const activeTargets = new Set<string>();
			for (const name of explicitTargets) {
				if (excluded.has(name)) continue;
				if (yield* config.isIgnored(name, resolvedCwd)) continue;
				activeTargets.add(name);
			}
			const inScopeFor = (name: string): boolean =>
				explicitTargets.size > 0 ? activeTargets.has(name) : inScope.has(name) && !excluded.has(name);

			// Restrict, then drop release-neutral rows (unless kept), then drop
			// diffs whose rows became empty. Specifier resolution already happened
			// per-side inside computeWorkspaceDependencyDiffs, so rows arrive
			// fully resolved. `runtime` and `packageManager` (#544) sit in the
			// same release-neutral bucket as `devDependency` — today the diff
			// generator only emits the four npm-field types, so their inclusion
			// here is defensive classification, not a behavior change.
			const keepDevDeps = options.includeDevDeps === true;
			const releaseNeutral = new Set<string>(["devDependency", "runtime", "packageManager"]);
			const scoped = rawDiffs.filter((d) => inScopeFor(d.package));

			const resolved: WorkspaceDependencyDiff[] = [];
			for (const diff of scoped) {
				const rows = keepDevDeps ? [...diff.rows] : diff.rows.filter((r) => !releaseNeutral.has(r.type));
				if (rows.length > 0) resolved.push({ ...diff, rows: sortDependencyRows(rows) });
			}

			const existingPure = yield* findPureDependencyChangesets(fs, changesetDir);
			const skippedMixed = yield* findMixedDependencyChangesets(fs, changesetDir);

			// Informational: prose-only changesets releasing an in-scope package.
			// The run never touches them, but the result must account for them so
			// an agent reading it does not double-create content or re-list
			// .changeset/ to confirm the package's full changeset picture (#279).
			const coexisting = (yield* findProseChangesets(fs, changesetDir))
				.map((p) => ({ file: p.file, packages: p.packages.filter(inScopeFor) }))
				.filter((p) => p.packages.length > 0);

			// A package is only "being rewritten this run" when it survives the
			// devDep-drop + empty-diff filters above and lands in `resolved` (the
			// list that feeds toWrite). A package whose only diff rows were
			// devDependency-only (dropped unless includeDevDeps) has ZERO resolved
			// rows and is never rewritten — its pre-existing pure dependency
			// changeset must therefore be left alone rather than deleted with
			// nothing to replace it (#258).
			const rewrittenPackages = new Set(resolved.map((d) => d.package));

			// A changeset already committed at `fromRef` (the merge base, reused
			// from the diff resolution above rather than re-running git) was
			// authored by an earlier, already-merged PR — a regen run on an
			// unrelated branch must never delete it, even for an in-scope package
			// that IS being rewritten this run (#258). Tolerant by construction:
			// when `fromRef` isn't a real, readable git ref (e.g. the synthetic
			// refs used by unit tests against a bare tmpdir), this resolves to an
			// empty set and the filter becomes a no-op.
			const atMergeBase = yield* gitListChangesetFilesAtRef(resolvedCwd, fromRef).pipe(Effect.provide(provideGit));
			const authoredOnBranch = (file: string): boolean => !atMergeBase.has(basename(file));

			// With explicit targets, only delete pure changesets for those packages
			// (unless ignored); otherwise delete pure-dep changesets for every
			// in-scope package that is actually being rewritten this run AND whose
			// file was authored on this branch (not present at the merge base).
			// Excluded packages, packages with no surviving diff rows, and
			// merge-base-authored files keep their existing changesets untouched.
			const toDelete = existingPure.filter(
				(p) => inScopeFor(p.package) && rewrittenPackages.has(p.package) && authoredOnBranch(p.file),
			);

			const chosenFilenames = new Set<string>();
			const toWrite: Array<{ file: string; package: string; diff: WorkspaceDependencyDiff }> = [];
			for (const diff of resolved) {
				const filename = yield* randomFilename(fileExists, changesetDir, chosenFilenames);
				toWrite.push({ file: join(changesetDir, `${filename}.md`), package: diff.package, diff });
			}

			return { toDelete, toWrite, skippedMixed, coexisting };
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
			return { deleted, written, skippedMixed: plan.skippedMixed, coexisting: plan.coexisting };
		});

	return { plan, execute };
}

// Shared sub-graph — single const so Layer memoization (by reference)
// constructs the config chain exactly once across the branches below.
const ConfigGraph = ChangesetConfig.layer.pipe(Layer.provide(ChangesetConfigReader.layer));

/**
 * Build the batteries-included {@link DepsRegen} layer over a
 * `@effected/workspaces` kit graph bound to `options.cwd`.
 *
 * @remarks
 * The kit's root-consuming services (`WorkspaceDiscovery`,
 * `WorkspaceSnapshots`, `WorkspaceRoot`) resolve their workspace root from
 * the layer they were built with — single-root by design. {@link DepsRegenDefault}
 * is this builder bound with no options (root from `process.cwd()`, read
 * lazily); pass an explicit `cwd` when planning against a different root
 * (fixtures, multi-repo hosts).
 *
 * The graph is `Workspaces.layerWithGitAndConfigDependenciesSubprocess` —
 * `layerWithGit`'s service set with config-dependency hook replay in catalog
 * assembly, so hook-injected catalogs resolve to ranges (#539). The subprocess
 * replay is chosen over the in-process one because silk's consumers (the
 * `savvy` CLI, the `savvy-mcp` server) are bundled, and a bundler compiles the
 * in-process replay's computed dynamic `import()` into a context module that
 * cannot resolve at runtime. The kit mints a fresh layer reference per call,
 * so the graph is bound ONCE per builder call and shared across every internal
 * branch — layer memoization by reference constructs each kit service exactly
 * once.
 *
 * @public
 */
export function makeDepsRegenDefault(
	options?: WorkspacesOptions,
): Layer.Layer<DepsRegen, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
	const kitGraph = Workspaces.layerWithGitAndConfigDependenciesSubprocess(options);
	return DepsRegen.layer.pipe(
		Layer.provide(ConfigInspector.layer.pipe(Layer.provide(Layer.mergeAll(ChangesetConfigReader.layer, kitGraph)))),
		Layer.provide(SilkPublishability.layerAdaptive.pipe(Layer.provide(Layer.mergeAll(ConfigGraph, kitGraph)))),
		Layer.provide(ConfigGraph),
		Layer.provide(kitGraph),
	);
}

/**
 * Batteries-included {@link DepsRegen} layer: silk's opinionated default
 * composition of the full dependency graph, root-bound to `process.cwd()`
 * (see {@link makeDepsRegenDefault} for an explicit root). Only the platform
 * services remain — note that `WorkspaceSnapshots` reads git history, so
 * this layer genuinely requires `ChildProcessSpawner` in addition to
 * `FileSystem`/`Path`: provide a git-capable platform layer
 * (`NodeServices.layer`), not a bare filesystem-only layer.
 *
 * Gating uses silk's adaptive publishability detector
 * (`SilkPublishability.layerAdaptive`), so the default semantics
 * are "versionable minus ignored" — identical to the savvy CLI and MCP
 * runtimes. Consumers who need to swap any dependency (test detectors,
 * alternate config sources) should keep composing {@link DepsRegen.layer}
 * directly; this layer is purely additive.
 *
 * @example
 * ```typescript
 * import { NodeServices } from "@effect/platform-node";
 * import { Layer } from "effect";
 * import { Changesets } from "@savvy-web/silk-effects";
 *
 * const depsRegen = Changesets.DepsRegenDefault.pipe(Layer.provide(NodeServices.layer));
 * ```
 *
 * @public
 */
export const DepsRegenDefault: Layer.Layer<
	DepsRegen,
	never,
	FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> = makeDepsRegenDefault();

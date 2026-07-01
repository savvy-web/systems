/**
 * `Changesets.DepsRegen` service — lift the `deps regen` / `deps detect`
 * orchestration out of the CLI into a `Context.Tag` service with a
 * `plan()` / `execute()` split.
 *
 * @remarks
 * `plan()` computes the cumulative dependency diff (merge-base → working
 * tree by default, or between two explicit refs), resolves `catalog:` /
 * `workspace:` specifiers to concrete versions, drops `devDependency`
 * rows (unless `includeDevDeps`), and returns a complete {@link RegenPlan}
 * (target filenames + stale-changeset deletes) WITHOUT touching the
 * filesystem. `execute()` applies a plan — deleting stale pure-dependency
 * changesets, then writing the fresh ones.
 *
 * This is the single source of truth for regen/detect: the CLI commands
 * and MCP tools are thin adapters over this service.
 *
 * @see {@link DepsRegen} for the service tag
 * @see {@link DepsRegenLive} for the production layer
 *
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Context, Effect, Layer, Option } from "effect";
import { CatalogResolver, PublishabilityDetector, WorkspaceDiscovery } from "workspaces-effect";
import type { GitError } from "../errors.js";
import type { DependencyTableRow } from "../schemas/dependency-table.js";
import type { WorkspaceDependencyDiff } from "../utils/dep-diff.js";
import { computeWorkspaceDependencyDiffs } from "../utils/dep-diff.js";
import { serializeDependencyTableToMarkdown, sortDependencyRows } from "../utils/dependency-table.js";
import { listPublishablePackageNames } from "../utils/publishability.js";
import { gitMergeBase, snapshotFromWorktree } from "../utils/worktree-snapshot.js";
import { ConfigInspector } from "./config-inspector.js";
import { WorkspaceSnapshotReader } from "./workspace-snapshot.js";

/** The em-dash sentinel (U+2014) used for added ("from") / removed ("to") cells. */
const EM_DASH = "—";

/** Whether a From/To cell holds a pnpm protocol specifier that could resolve to a version. */
const isProtocol = (v: string): boolean => /^(?:catalog|workspace|npm|jsr|file|link|portal):/.test(v);

/**
 * Resolve protocol From/To cells to concrete versions (raw-string fallback
 * when unresolved or on resolver error), leave em-dash sentinels untouched,
 * then optionally drop `devDependency` rows, and re-sort.
 *
 * @param diff - One workspace package's dependency-table rows.
 * @param keepDevDeps - When `true`, retain `devDependency` rows; otherwise
 *   drop them unconditionally (the regen default).
 * @returns An Effect yielding the transformed {@link WorkspaceDependencyDiff}.
 *
 * @public
 */
export const resolveDiffRows = (
	diff: WorkspaceDependencyDiff,
	keepDevDeps = false,
): Effect.Effect<WorkspaceDependencyDiff, never, CatalogResolver> =>
	Effect.gen(function* () {
		const resolver = yield* CatalogResolver;
		const resolveCell = (dep: string, value: string): Effect.Effect<string, never> =>
			isProtocol(value)
				? resolver.resolveSpecifier(dep, value).pipe(
						Effect.map((opt) => Option.getOrElse(opt, () => value)),
						Effect.catchAll((error) =>
							Effect.logWarning(
								`DepsRegen: catalog resolution failed for "${dep}" (${value}); keeping raw specifier: ${String(error)}`,
							).pipe(Effect.as(value)),
						),
					)
				: Effect.succeed(value);

		const rows: DependencyTableRow[] = [];
		for (const row of diff.rows) {
			if (!keepDevDeps && row.type === "devDependency") continue;
			const from = row.from === EM_DASH ? EM_DASH : yield* resolveCell(row.dependency, row.from);
			const to = row.to === EM_DASH ? EM_DASH : yield* resolveCell(row.dependency, row.to);
			rows.push({ ...row, from, to });
		}
		return { ...diff, rows: sortDependencyRows(rows) };
	});

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
 * never writes to disk, so `existsSync` alone cannot see slugs chosen
 * moments earlier in the same call — the `chosen` set closes that gap.
 * The triplet space is 1,000 combinations, so a busy repo can plausibly
 * exhaust it across runs; fall back to a timestamp suffix after 20
 * unlucky picks.
 *
 * @param changesetDir - Directory checked via `existsSync` for on-disk collisions.
 * @param chosen - Basenames (without extension) already picked within this plan;
 *   the picked candidate is added to this set before returning.
 * @internal
 */
function randomFilename(changesetDir: string, chosen: Set<string>): string {
	for (let i = 0; i < 20; i++) {
		const candidate = pickRandomTriplet();
		if (!chosen.has(candidate) && !existsSync(join(changesetDir, `${candidate}.md`))) {
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
	while (chosen.has(fallback) || existsSync(join(changesetDir, `${fallback}.md`))) {
		fallback = `${pickRandomTriplet()}-${Date.now()}-${++attempt}`;
	}
	chosen.add(fallback);
	return fallback;
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

function listChangesetFiles(changesetDir: string): ReadonlyArray<string> {
	if (!existsSync(changesetDir)) return [];
	return readdirSync(changesetDir)
		.filter((f) => f.endsWith(".md") && f !== "README.md")
		.map((f) => join(changesetDir, f));
}

function findPureDependencyChangesets(
	changesetDir: string,
): ReadonlyArray<{ readonly file: string; readonly package: string }> {
	const result: Array<{ file: string; package: string }> = [];
	for (const file of listChangesetFiles(changesetDir)) {
		let content: string;
		try {
			content = readFileSync(file, "utf8");
		} catch {
			continue;
		}
		const detection = isPureDependencyChangeset(content);
		if (detection.isPure && detection.package) {
			result.push({ file, package: detection.package });
		}
	}
	return result;
}

function findMixedDependencyChangesets(changesetDir: string): ReadonlyArray<string> {
	const result: string[] = [];
	for (const file of listChangesetFiles(changesetDir)) {
		let content: string;
		try {
			content = readFileSync(file, "utf8");
		} catch {
			continue;
		}
		// Mixed = has a `## Dependencies` heading but doesn't pass the strict test.
		if (/^## Dependencies\b/m.test(content) && !isPureDependencyChangeset(content).isPure) {
			result.push(file);
		}
	}
	return result;
}

/**
 * Render a single-package, patch-bump changeset for a diff whose rows have
 * already been resolved/filtered by {@link resolveDiffRows}.
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
	 * + untracked) via {@link snapshotFromWorktree}.
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
	 * Compute a complete {@link RegenPlan} without touching the filesystem.
	 *
	 * @param options - See {@link DepsRegenOptions}.
	 * @returns An Effect yielding the plan, or failing with {@link GitError}.
	 */
	readonly plan: (options: DepsRegenOptions) => Effect.Effect<RegenPlan, GitError, never>;
	/**
	 * Apply a {@link RegenPlan}: delete stale changesets, write fresh ones.
	 *
	 * @param plan - The plan produced by {@link DepsRegenShape.plan}.
	 * @returns An Effect yielding a {@link RegenResult}.
	 */
	readonly execute: (plan: RegenPlan) => Effect.Effect<RegenResult, never, never>;
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
	reader: typeof WorkspaceSnapshotReader.Service,
	inspector: typeof ConfigInspector.Service,
	discovery: typeof WorkspaceDiscovery.Service,
	resolver: typeof CatalogResolver.Service,
	detector: typeof PublishabilityDetector.Service,
): DepsRegenShape {
	const provideResolver = Layer.succeed(CatalogResolver, resolver);
	const provideDetector = Layer.succeed(PublishabilityDetector, detector);

	const plan = (options: DepsRegenOptions): Effect.Effect<RegenPlan, GitError, never> =>
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

			// Snapshots: before = from ref, after = to ref (or working tree).
			const beforeSnaps = yield* reader.snapshotAt(resolvedCwd, fromRef);
			const afterSnaps = options.to
				? yield* reader.snapshotAt(resolvedCwd, options.to)
				: snapshotFromWorktree(resolvedCwd);

			const rawDiffs = computeWorkspaceDependencyDiffs(beforeSnaps, afterSnaps);
			const targetPkg = options.package;

			// Publishable-package set — used both to filter diffs (absent an
			// explicit `--package`) and to bound stale-changeset deletion.
			const livePackages = yield* discovery.listPackages(resolvedCwd).pipe(Effect.catchAll(() => Effect.succeed([])));
			const publishable = yield* listPublishablePackageNames(livePackages).pipe(Effect.provide(provideDetector));

			// Restrict, then resolve protocol cells + drop devDeps, then drop
			// diffs whose rows became empty.
			const keepDevDeps = options.includeDevDeps === true;
			const scoped = targetPkg
				? rawDiffs.filter((d) => d.package === targetPkg)
				: rawDiffs.filter((d) => publishable.has(d.package));

			const resolved: WorkspaceDependencyDiff[] = [];
			for (const diff of scoped) {
				const next = yield* resolveDiffRows(diff, keepDevDeps).pipe(Effect.provide(provideResolver));
				if (next.rows.length > 0) resolved.push(next);
			}

			const existingPure = findPureDependencyChangesets(changesetDir);
			const skippedMixed = findMixedDependencyChangesets(changesetDir);

			// When `--package` is set, only delete pure changesets for that
			// package; otherwise delete pure-dep changesets for every publishable
			// package — even stale ones with no current dep changes.
			const toDelete = targetPkg
				? existingPure.filter((p) => p.package === targetPkg)
				: existingPure.filter((p) => publishable.has(p.package));

			const chosenFilenames = new Set<string>();
			const toWrite = resolved.map((diff) => ({
				file: join(changesetDir, `${randomFilename(changesetDir, chosenFilenames)}.md`),
				package: diff.package,
				diff,
			}));

			return { toDelete, toWrite, skippedMixed };
		});

	const execute = (plan: RegenPlan): Effect.Effect<RegenResult, never, never> =>
		Effect.sync(() => {
			const deleted: string[] = [];
			const written: string[] = [];
			// Delete first, then write.
			for (const entry of plan.toDelete) {
				try {
					unlinkSync(entry.file);
					deleted.push(entry.file);
				} catch {
					// Missing/undeletable file — nothing to remove; skip silently.
				}
			}
			for (const entry of plan.toWrite) {
				writeFileSync(entry.file, renderChangesetContent(entry.diff));
				written.push(entry.file);
			}
			return { deleted, written, skippedMixed: plan.skippedMixed };
		});

	return { plan, execute };
}

/**
 * Live layer for {@link DepsRegen}.
 *
 * Requires {@link WorkspaceSnapshotReader}, {@link ConfigInspector},
 * `WorkspaceDiscovery`, `CatalogResolver`, and `PublishabilityDetector`
 * (the last three from `workspaces-effect`).
 *
 * @public
 */
export const DepsRegenLive: Layer.Layer<
	DepsRegen,
	never,
	WorkspaceSnapshotReader | ConfigInspector | WorkspaceDiscovery | CatalogResolver | PublishabilityDetector
> = Layer.effect(
	DepsRegen,
	Effect.gen(function* () {
		const reader = yield* WorkspaceSnapshotReader;
		const inspector = yield* ConfigInspector;
		const discovery = yield* WorkspaceDiscovery;
		const resolver = yield* CatalogResolver;
		const detector = yield* PublishabilityDetector;
		return makeShape(reader, inspector, discovery, resolver, detector);
	}),
);

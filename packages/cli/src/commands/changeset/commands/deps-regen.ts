/**
 * `deps regen` command — delete all pure dependency changesets and
 * write fresh single-package, patch-bump changesets reflecting the
 * cumulative dep diff from base to working tree.
 *
 * @remarks
 * **The single-package-per-changeset rule.** This command enforces our
 * convention that each `.changeset/*.md` file lists exactly one package
 * in its frontmatter. `@changesets/cli` technically supports multi-package
 * frontmatter, but our agent (and this command) always produces single-
 * package files for clarity and easier hand-editing.
 *
 * **Strict "pure dependency changeset" detection.** A changeset is
 * eligible for deletion-and-regeneration if and only if:
 *
 * 1. Its frontmatter declares exactly one package, and
 * 2. Its body contains exactly one `##` heading, and
 * 3. That heading is `Dependencies`.
 *
 * Anything else (multi-package frontmatter, additional sections, comments,
 * `### Sub-headings`, etc.) is treated as "mixed" and left untouched.
 * That's the safe default — if a human authored something idiosyncratic,
 * we don't clobber it.
 *
 * **The algorithm:**
 *
 * 1. Compute dep diff from `merge-base(baseBranch, HEAD)` to working
 *    tree, grouped by workspace package.
 * 2. Find every pure-dependency changeset (strict definition).
 * 3. Delete every one of them — even those for packages with no current
 *    dep changes (their changeset is stale by definition).
 * 4. Write a fresh `<adjective>-<noun>-<verb>.md` per workspace package
 *    that has current dep changes: single-package frontmatter, `patch`
 *    bump, one `## Dependencies` section, one CSH005 table.
 *
 * @example
 * ```bash
 * savvy changeset deps regen
 * savvy changeset deps regen --dry-run --json
 * savvy changeset deps regen --package @scope/foo
 * ```
 *
 * @internal
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { WorkspaceDiscovery } from "workspaces-effect";

type WorkspaceDependencyDiff = Changesets.WorkspaceDependencyDiff;
const {
	ConfigInspector,
	WorkspaceSnapshotReader,
	computeWorkspaceDependencyDiffs,
	gitMergeBase,
	listPublishablePackageNames,
	serializeDependencyTableToMarkdown,
	snapshotFromWorktree,
} = Changesets;

/* v8 ignore start -- CLI option definitions */
const cwdOption = Options.directory("cwd").pipe(
	Options.withDescription("Project root (defaults to the current working directory)"),
	Options.withDefault("."),
);
const baseOption = Options.text("base").pipe(
	Options.withDescription("Override the base branch (defaults to config baseBranch)"),
	Options.optional,
);
const packageOption = Options.text("package").pipe(
	Options.withDescription("Restrict regeneration to a single workspace package"),
	Options.optional,
);
const dryRunOption = Options.boolean("dry-run").pipe(
	Options.withDescription("Print the plan without writing or deleting"),
	Options.withDefault(false),
);
const jsonOption = Options.boolean("json").pipe(
	Options.withDescription("Emit a structured plan as JSON"),
	Options.withDefault(false),
);
/* v8 ignore stop */

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
 * with an existing `.changeset/*.md`. The triplet space is 1,000
 * combinations, so a busy repo can plausibly exhaust it across runs;
 * fall back to a timestamp suffix after 20 unlucky picks.
 *
 * @internal
 */
function randomFilename(changesetDir: string): string {
	for (let i = 0; i < 20; i++) {
		const candidate = pickRandomTriplet();
		if (!existsSync(join(changesetDir, `${candidate}.md`))) return candidate;
	}
	return `${pickRandomTriplet()}-${Date.now()}`;
}

/**
 * Strict detection of "pure dependency changesets" per the documented
 * rules: single-package frontmatter, single `## Dependencies` heading,
 * no other body content beyond that section.
 *
 * @internal
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

interface RegenPlan {
	readonly toDelete: ReadonlyArray<{ readonly file: string; readonly package: string }>;
	readonly toWrite: ReadonlyArray<{
		readonly file: string;
		readonly package: string;
		readonly diff: WorkspaceDependencyDiff;
	}>;
	readonly skippedMixed: ReadonlyArray<string>;
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

function renderChangesetContent(diff: WorkspaceDependencyDiff): string {
	const frontmatter = `---\n"${diff.package}": patch\n---`;
	const table = serializeDependencyTableToMarkdown([...diff.rows]);
	return `${frontmatter}\n\n## Dependencies\n\n${table}\n`;
}

/**
 * Handler exported for direct invocation in tests.
 *
 * @internal
 */
export function runDepsRegen(
	cwd: string,
	base: Option.Option<string>,
	pkg: Option.Option<string>,
	dryRun: boolean,
	json: boolean,
) {
	return Effect.gen(function* () {
		const resolvedCwd = resolve(cwd);
		const changesetDir = join(resolvedCwd, ".changeset");
		const reader = yield* WorkspaceSnapshotReader;

		// Resolve base branch.
		let baseBranch = Option.getOrUndefined(base);
		if (!baseBranch) {
			const inspector = yield* ConfigInspector;
			const inspected = yield* inspector
				.inspect(resolvedCwd)
				.pipe(
					Effect.catchTag("ConfigurationError", () => Effect.succeed({ baseBranch: "main" } as { baseBranch: string })),
				);
			baseBranch = inspected.baseBranch;
		}

		const mergeBase = yield* gitMergeBase(resolvedCwd, baseBranch).pipe(
			Effect.catchTag("GitError", (err) => {
				process.exitCode = 1;
				return Effect.fail(err);
			}),
		);

		// Snapshots: before = merge-base, after = working tree.
		const beforeSnaps = yield* reader.snapshotAt(resolvedCwd, mergeBase).pipe(
			Effect.catchTag("GitError", (err) => {
				process.exitCode = 1;
				return Effect.fail(err);
			}),
		);
		const afterSnaps = snapshotFromWorktree(resolvedCwd);

		let diffs = computeWorkspaceDependencyDiffs(beforeSnaps, afterSnaps);
		const targetPkg = Option.getOrUndefined(pkg);

		// Filter to publishable packages (unless --package is explicit).
		// Non-publishable workspaces (e.g., the private monorepo root)
		// would never contribute their dep changes to a release, so a
		// regen pass produces nothing for them and any pre-existing
		// pure-dep changeset for one of them is treated as stale and
		// removed (see toDelete below).
		const discovery = yield* WorkspaceDiscovery;
		const livePackages = yield* discovery.listPackages(resolvedCwd).pipe(Effect.catchAll(() => Effect.succeed([])));
		const publishable = yield* listPublishablePackageNames(livePackages);

		if (targetPkg) {
			diffs = diffs.filter((d) => d.package === targetPkg);
		} else {
			diffs = diffs.filter((d) => publishable.has(d.package));
		}

		const existingPure = findPureDependencyChangesets(changesetDir);
		const skippedMixed = findMixedDependencyChangesets(changesetDir);

		// When --package is set, only delete pure changesets for that package.
		// Otherwise, delete pure-dep changesets for every publishable
		// package — even those with no current dep changes (stale). A
		// pure-dep changeset for a non-publishable package was probably
		// authored by mistake; leave it alone so the user can decide.
		const toDelete = targetPkg
			? existingPure.filter((p) => p.package === targetPkg)
			: existingPure.filter((p) => publishable.has(p.package));

		const toWrite = diffs.map((diff) => ({
			file: join(changesetDir, `${randomFilename(changesetDir)}.md`),
			package: diff.package,
			diff,
		}));

		const plan: RegenPlan = { toDelete, toWrite, skippedMixed };

		if (dryRun) {
			if (json) {
				yield* Effect.log(JSON.stringify(plan, null, 2));
			} else {
				yield* renderHumanPlan(plan);
			}
			return;
		}

		// Execute. Delete first, then write.
		for (const entry of toDelete) {
			try {
				unlinkSync(entry.file);
			} catch (error) {
				yield* Effect.logWarning(
					`Failed to delete ${entry.file}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
		for (const entry of toWrite) {
			writeFileSync(entry.file, renderChangesetContent(entry.diff));
		}

		if (json) {
			yield* Effect.log(JSON.stringify(plan, null, 2));
		} else {
			yield* renderHumanPlan(plan);
		}
	});
}

function renderHumanPlan(plan: RegenPlan) {
	return Effect.gen(function* () {
		if (plan.toDelete.length === 0 && plan.toWrite.length === 0) {
			yield* Effect.log("No dependency changes to regenerate.");
		} else {
			if (plan.toDelete.length > 0) {
				yield* Effect.log(`Deleted ${plan.toDelete.length} pure dependency changeset(s):`);
				for (const entry of plan.toDelete) {
					yield* Effect.log(`  - ${entry.file}  (${entry.package})`);
				}
			}
			if (plan.toWrite.length > 0) {
				yield* Effect.log(`Wrote ${plan.toWrite.length} fresh dependency changeset(s):`);
				for (const entry of plan.toWrite) {
					yield* Effect.log(
						`  + ${entry.file}  (${entry.package} — ${entry.diff.rows.length} row${entry.diff.rows.length === 1 ? "" : "s"})`,
					);
				}
			}
		}
		if (plan.skippedMixed.length > 0) {
			yield* Effect.log(
				`\nSkipped ${plan.skippedMixed.length} mixed changeset(s) (have Dependencies but also other content):`,
			);
			for (const file of plan.skippedMixed) {
				yield* Effect.log(`  ~ ${file}`);
			}
		}
	});
}

/* v8 ignore next 8 */
export const depsRegenCommand = Command.make(
	"regen",
	{ cwd: cwdOption, base: baseOption, package: packageOption, dryRun: dryRunOption, json: jsonOption },
	({ cwd, base, package: pkg, dryRun, json }) => runDepsRegen(cwd, base, pkg, dryRun, json),
).pipe(Command.withDescription("Delete pure dependency changesets and regenerate them from the current diff"));

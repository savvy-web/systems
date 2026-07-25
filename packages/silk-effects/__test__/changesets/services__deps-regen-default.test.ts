/**
 * Tests for {@link DepsRegenDefault} — the batteries-included default
 * composition of {@link DepsRegenLive}.
 *
 * Kept in its own file (rather than folded into
 * `services__deps-regen.test.ts`) because it exercises a real git fixture
 * end-to-end through the whole default graph (real `PointInTimeWorkspace`,
 * `WorkspaceDiscovery`, `ConfigInspector`, `ChangesetConfig`, and the
 * adaptive `PublishabilityDetector`) rather than the mock-layer unit style
 * used by the rest of that file — a distinct enough test shape to warrant
 * its own home.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { WorkspaceDiscovery, Workspaces } from "@effected/workspaces";
import { Effect, Layer } from "effect";
import { ConfigInspectorLive } from "../../src/changesets/services/config-inspector.js";
import {
	DepsRegen,
	DepsRegenDefault,
	DepsRegenLive,
	makeDepsRegenDefault,
} from "../../src/changesets/services/deps-regen.js";
import { ChangesetConfigLive } from "../../src/services/ChangesetConfig.js";
import { ChangesetConfigReaderLive } from "../../src/services/ChangesetConfigReader.js";
import { PublishabilityDetectorAdaptiveLive } from "../../src/services/SilkPublishability.js";

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "t@example.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "t@example.com",
		},
	});
}

// The kit graph inside DepsRegenDefault is root-bound (single-root by design;
// process.cwd() for the zero-arg binding), so every fixture test builds its
// own layer via makeDepsRegenDefault({ cwd: fixtureDir }).
const liveFor = (cwd: string) => makeDepsRegenDefault({ cwd }).pipe(Layer.provide(NodeServices.layer));

describe("DepsRegenDefault", () => {
	it.effect("resolves with only NodeServices.layer", () =>
		Effect.gen(function* () {
			const svc = yield* DepsRegen.pipe(Effect.provide(DepsRegenDefault.pipe(Layer.provide(NodeServices.layer))));
			expect(typeof svc.plan).toBe("function");
			expect(typeof svc.execute).toBe("function");
		}),
	);
});

describe("DepsRegenDefault — silk gating end-to-end (#209 semantics through the default graph)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	/**
	 * Real pnpm-workspace git fixture with two private, non-publishable
	 * packages — `@fix/priv-versioned` and `@fix/priv-ignored` — a
	 * `.changeset/config.json` with `privatePackages.version: true` and
	 * `ignore: ["@fix/priv-ignored"]`, a base commit, and a working-tree-only
	 * dependency bump in both packages' `package.json`.
	 */
	function makeFixture(): string {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-default-"));

		writeFileSync(
			join(dir, "package.json"),
			`${JSON.stringify({ name: "fixture-root", version: "0.0.0", private: true }, null, 2)}\n`,
		);
		writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
		writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

		for (const name of ["priv-versioned", "priv-ignored"]) {
			const pkgDir = join(dir, "packages", name);
			mkdirSync(pkgDir, { recursive: true });
			writeFileSync(
				join(pkgDir, "package.json"),
				`${JSON.stringify(
					{
						name: `@fix/${name}`,
						version: "1.0.0",
						private: true,
						dependencies: { "left-pad": "^1.0.0" },
					},
					null,
					2,
				)}\n`,
			);
		}

		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			`${JSON.stringify(
				{
					$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
					changelog: ["@savvy-web/changesets/changelog", {}],
					commit: false,
					access: "restricted",
					baseBranch: "main",
					updateInternalDependencies: "patch",
					ignore: ["@fix/priv-ignored"],
					privatePackages: { version: true, tag: false },
				},
				null,
				2,
			)}\n`,
		);
		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		// Working-tree-only from here down — this branch's own uncommitted
		// local regen output, never merged. The dependency bump makes both
		// packages' diffs non-empty; the pre-existing pure-dependency
		// changesets (added AFTER the base commit, so they are NOT present at
		// the merge base — #258) let the toDelete assertions distinguish
		// "deleted (in scope)" from "left alone (ignored)".
		for (const name of ["priv-versioned", "priv-ignored"]) {
			const pkgJsonPath = join(dir, "packages", name, "package.json");
			const raw = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { dependencies: Record<string, string> };
			raw.dependencies["left-pad"] = "^1.1.0";
			writeFileSync(pkgJsonPath, `${JSON.stringify(raw, null, 2)}\n`);
		}
		writeFileSync(
			join(dir, ".changeset", "stale-priv-versioned.md"),
			["---", '"@fix/priv-versioned": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
		);
		writeFileSync(
			join(dir, ".changeset", "stale-priv-ignored.md"),
			["---", '"@fix/priv-ignored": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
		);

		return dir;
	}

	it.effect(
		"versions the non-ignored private package and leaves the ignored one alone, through the default graph",
		() =>
			Effect.gen(function* () {
				const dir = makeFixture();
				dirs.push(dir);

				const plan = yield* Effect.gen(function* () {
					const svc = yield* DepsRegen;
					return yield* svc.plan({ cwd: dir });
				}).pipe(Effect.provide(liveFor(dir)));

				expect(plan.toWrite.map((w) => w.package)).toEqual(["@fix/priv-versioned"]);
				expect(plan.toDelete.map((d) => d.package)).toEqual(["@fix/priv-versioned"]);
				expect(plan.toDelete.map((d) => d.file)).toEqual([join(dir, ".changeset", "stale-priv-versioned.md")]);
			}),
	);
});

describe("DepsRegenDefault — genuinely publishable package (regression: publishable set must not be silently empty)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	/**
	 * Real pnpm-workspace git fixture with ONE publishable package —
	 * `@fix/pub` (`publishConfig.access: "public"`, NOT private) — and NO
	 * `privatePackages.version` / `ignore` gating in play. This isolates the
	 * `publishable` half of the "versionable minus ignored" gate: if
	 * `listPublishablePackageNames` is ever passed the wrong `root` again
	 * (e.g. a package's own directory instead of the project root), the
	 * adaptive detector's `.changeset/config.json` lookup silently misses,
	 * `mode` resolves to `"none"`, and this package would wrongly disappear
	 * from the plan even though it is the primary use case `DepsRegenDefault`
	 * exists for.
	 */
	function makePublishableFixture(): string {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-default-pub-"));

		writeFileSync(
			join(dir, "package.json"),
			`${JSON.stringify({ name: "fixture-root", version: "0.0.0", private: true }, null, 2)}\n`,
		);
		writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
		writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

		const pkgDir = join(dir, "packages", "pub");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			`${JSON.stringify(
				{
					name: "@fix/pub",
					version: "1.0.0",
					publishConfig: { access: "public" },
					dependencies: { "left-pad": "^1.0.0" },
				},
				null,
				2,
			)}\n`,
		);

		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			`${JSON.stringify(
				{
					$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
					changelog: ["@savvy-web/changesets/changelog", {}],
					commit: false,
					access: "restricted",
					baseBranch: "main",
					updateInternalDependencies: "patch",
					ignore: [],
				},
				null,
				2,
			)}\n`,
		);
		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		// Working-tree-only from here down (see makeFixture() above for why the
		// stale changeset must NOT be part of the base commit — #258).
		const pkgJsonPath = join(pkgDir, "package.json");
		const raw = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { dependencies: Record<string, string> };
		raw.dependencies["left-pad"] = "^1.1.0";
		writeFileSync(pkgJsonPath, `${JSON.stringify(raw, null, 2)}\n`);
		writeFileSync(
			join(dir, ".changeset", "stale-pub.md"),
			["---", '"@fix/pub": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
		);

		return dir;
	}

	it.effect("plans a fresh changeset AND deletes the stale one for a publishConfig.access:public package", () =>
		Effect.gen(function* () {
			const dir = makePublishableFixture();
			dirs.push(dir);

			const plan = yield* Effect.gen(function* () {
				const svc = yield* DepsRegen;
				return yield* svc.plan({ cwd: dir });
			}).pipe(Effect.provide(liveFor(dir)));

			expect(plan.toWrite.map((w) => w.package)).toEqual(["@fix/pub"]);
			expect(plan.toDelete.map((d) => d.package)).toEqual(["@fix/pub"]);
			expect(plan.toDelete.map((d) => d.file)).toEqual([join(dir, ".changeset", "stale-pub.md")]);
		}),
	);
});

describe("DepsRegenDefault — worktree freshness (regression: stale WorkspaceDiscovery cache)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	/**
	 * Real pnpm-workspace git fixture with one versionable package and a
	 * committed base state. Unlike the other fixtures, the dependency bump is
	 * NOT applied here — the test applies it AFTER first enumerating the
	 * workspace, mirroring silk-update-action's main phase (RegularDeps lists
	 * packages, then edits manifests, then DepsRegen plans). workspaces-effect
	 * caches listPackages per root for the layer lifetime and Effect memoizes
	 * `WorkspaceDiscoveryLive` by reference across composition branches, so
	 * without an explicit refresh the plan's worktree side is served from the
	 * pre-edit cache and the diff collapses to a no-op.
	 */
	function makeUnbumpedFixture(): string {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-default-fresh-"));

		writeFileSync(
			join(dir, "package.json"),
			`${JSON.stringify({ name: "fixture-root", version: "0.0.0", private: true }, null, 2)}\n`,
		);
		writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
		writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

		const pkgDir = join(dir, "packages", "fresh");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			`${JSON.stringify(
				{
					name: "@fix/fresh",
					version: "1.0.0",
					private: true,
					dependencies: { "left-pad": "^1.0.0" },
				},
				null,
				2,
			)}\n`,
		);

		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			`${JSON.stringify(
				{
					$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
					changelog: ["@savvy-web/changesets/changelog", {}],
					commit: false,
					access: "restricted",
					baseBranch: "main",
					updateInternalDependencies: "patch",
					ignore: [],
					privatePackages: { version: true, tag: false },
				},
				null,
				2,
			)}\n`,
		);

		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		return dir;
	}

	it.effect("sees manifest edits made after the workspace was already enumerated in the same process", () =>
		Effect.gen(function* () {
			const dir = makeUnbumpedFixture();
			dirs.push(dir);

			// Mirror makeDepsRegenDefault's composition around ONE explicitly-shared
			// kit graph const, merged back out so the test can prime the very same
			// memoized WorkspaceDiscovery instance the DepsRegen graph reads —
			// exercising plan()'s up-front refresh against a genuinely stale cache.
			const kit = Workspaces.layerWithGit({ cwd: dir });
			const configGraph = ChangesetConfigLive.pipe(Layer.provide(ChangesetConfigReaderLive));
			const freshLive = Layer.mergeAll(
				DepsRegenLive.pipe(
					Layer.provide(ConfigInspectorLive.pipe(Layer.provide(Layer.mergeAll(ChangesetConfigReaderLive, kit)))),
					Layer.provide(PublishabilityDetectorAdaptiveLive.pipe(Layer.provide(Layer.mergeAll(configGraph, kit)))),
					Layer.provide(configGraph),
					Layer.provide(kit),
				),
				kit,
			).pipe(Layer.provide(NodeServices.layer));

			const plan = yield* Effect.gen(function* () {
				// Prime the (memoized, shared) discovery cache before the edit.
				const discovery = yield* WorkspaceDiscovery;
				yield* discovery.listPackages();

				// Now edit the manifest on disk, as an updater tool would.
				const pkgJsonPath = join(dir, "packages", "fresh", "package.json");
				const raw = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { dependencies: Record<string, string> };
				raw.dependencies["left-pad"] = "^1.1.0";
				writeFileSync(pkgJsonPath, `${JSON.stringify(raw, null, 2)}\n`);

				const svc = yield* DepsRegen;
				return yield* svc.plan({ cwd: dir });
			}).pipe(Effect.provide(freshLive));

			expect(plan.toWrite.map((w) => w.package)).toEqual(["@fix/fresh"]);
		}),
	);
});

describe("DepsRegenDefault — merge-base authorship filter (regression: #258)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	/**
	 * Real pnpm-workspace git fixture with one versionable package
	 * (`@fix/mb`) and a pure dependency changeset COMMITTED at the base
	 * commit (`at-merge-base.md`) — standing in for a changeset authored by
	 * an earlier, already-merged PR. On top of that base commit, this test
	 * leaves TWO things uncommitted (working-tree-only, standing in for this
	 * branch's own not-yet-merged work): a real dependency bump in
	 * `@fix/mb/package.json`, and a second pure dependency changeset
	 * (`branch-authored.md`) — the kind of stale local regen artifact a
	 * developer would want cleaned up by a fresh `deps regen` run. Because
	 * there is only ever one branch in this fixture, `git merge-base main
	 * HEAD` resolves to the base commit itself, which is exactly the ref
	 * that must protect `at-merge-base.md`.
	 */
	function makeMergeBaseFixture(): string {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-mergebase-"));

		writeFileSync(
			join(dir, "package.json"),
			`${JSON.stringify({ name: "fixture-root", version: "0.0.0", private: true }, null, 2)}\n`,
		);
		writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
		writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

		const pkgDir = join(dir, "packages", "mb");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			`${JSON.stringify(
				{
					name: "@fix/mb",
					version: "1.0.0",
					private: true,
					dependencies: { "left-pad": "^1.0.0" },
				},
				null,
				2,
			)}\n`,
		);

		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			`${JSON.stringify(
				{
					$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
					changelog: ["@savvy-web/changesets/changelog", {}],
					commit: false,
					access: "restricted",
					baseBranch: "main",
					updateInternalDependencies: "patch",
					ignore: [],
					privatePackages: { version: true, tag: false },
				},
				null,
				2,
			)}\n`,
		);
		// Committed at the base commit — must survive any regen run on top of it.
		writeFileSync(
			join(dir, ".changeset", "at-merge-base.md"),
			["---", '"@fix/mb": patch', "---", "", "## Dependencies", "", "(already-merged table)", ""].join("\n"),
		);

		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		// Working-tree-only from here down — this branch's own uncommitted work.
		const pkgJsonPath = join(pkgDir, "package.json");
		const raw = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { dependencies: Record<string, string> };
		raw.dependencies["left-pad"] = "^1.1.0";
		writeFileSync(pkgJsonPath, `${JSON.stringify(raw, null, 2)}\n`);

		writeFileSync(
			join(dir, ".changeset", "branch-authored.md"),
			["---", '"@fix/mb": patch', "---", "", "## Dependencies", "", "(stale local table)", ""].join("\n"),
		);

		return dir;
	}

	it.effect(
		"keeps the changeset already committed at the merge base, and only deletes the branch-authored stale one",
		() =>
			Effect.gen(function* () {
				const dir = makeMergeBaseFixture();
				dirs.push(dir);

				const atMergeBasePath = join(dir, ".changeset", "at-merge-base.md");
				const branchAuthoredPath = join(dir, ".changeset", "branch-authored.md");

				const { plan, result } = yield* Effect.gen(function* () {
					const svc = yield* DepsRegen;
					const plan = yield* svc.plan({ cwd: dir });
					const result = yield* svc.execute(plan);
					return { plan, result };
				}).pipe(Effect.provide(liveFor(dir)));

				expect(plan.toWrite.map((w) => w.package)).toEqual(["@fix/mb"]);
				expect(plan.toDelete.map((d) => d.file)).toEqual([branchAuthoredPath]);
				expect(plan.toDelete.map((d) => d.file)).not.toContain(atMergeBasePath);

				expect(result.deleted).toEqual([branchAuthoredPath]);
				expect(existsSync(atMergeBasePath)).toBe(true);
				expect(existsSync(branchAuthoredPath)).toBe(false);
				expect(result.written).toHaveLength(1);
			}),
	);
});

describe("DepsRegenDefault — ChangesetConfig freshness (regression: #229 long-lived process staleness)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	/**
	 * Real pnpm-workspace git fixture with one private, versionable package
	 * and NOT yet ignored — a base commit, and a working-tree-only dependency
	 * bump. The ignore list starts empty so the first `plan()` call schedules
	 * the package, which also primes `ChangesetConfig`'s per-root cache
	 * (`isIgnored`/`versionPrivate`) through the shared `DepsRegenDefault`
	 * graph — the same graph a long-lived MCP server process holds for its
	 * whole lifetime.
	 */
	function makeIgnoreFixture(): string {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-default-ignore-"));

		writeFileSync(
			join(dir, "package.json"),
			`${JSON.stringify({ name: "fixture-root", version: "0.0.0", private: true }, null, 2)}\n`,
		);
		writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
		writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

		const pkgDir = join(dir, "packages", "stale-ignore");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			`${JSON.stringify(
				{
					name: "@fix/stale-ignore",
					version: "1.0.0",
					private: true,
					dependencies: { "left-pad": "^1.0.0" },
				},
				null,
				2,
			)}\n`,
		);

		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			`${JSON.stringify(
				{
					$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
					changelog: ["@savvy-web/changesets/changelog", {}],
					commit: false,
					access: "restricted",
					baseBranch: "main",
					updateInternalDependencies: "patch",
					ignore: [],
					privatePackages: { version: true, tag: false },
				},
				null,
				2,
			)}\n`,
		);
		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		// Working-tree-only dependency bump so the diff is non-empty for both
		// plan() calls below.
		const pkgJsonPath = join(pkgDir, "package.json");
		const raw = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { dependencies: Record<string, string> };
		raw.dependencies["left-pad"] = "^1.1.0";
		writeFileSync(pkgJsonPath, `${JSON.stringify(raw, null, 2)}\n`);

		return dir;
	}

	it.effect("a second plan() in the same runtime sees an ignore-list edit made after the first plan() call", () =>
		Effect.gen(function* () {
			const dir = makeIgnoreFixture();
			dirs.push(dir);
			const configPath = join(dir, ".changeset", "config.json");

			const { firstPlan, secondPlan } = yield* Effect.gen(function* () {
				const svc = yield* DepsRegen;
				const firstPlan = yield* svc.plan({ cwd: dir });

				const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
				raw.ignore = ["@fix/stale-ignore"];
				writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`);

				const secondPlan = yield* svc.plan({ cwd: dir });
				return { firstPlan, secondPlan };
			}).pipe(Effect.provide(liveFor(dir)));

			expect(firstPlan.toWrite.map((w) => w.package)).toEqual(["@fix/stale-ignore"]);
			expect(secondPlan.toWrite.map((w) => w.package)).toEqual([]);
			expect(secondPlan.toDelete.map((d) => d.package)).toEqual([]);
		}),
	);
});

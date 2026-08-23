import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Git } from "@effected/git";
import {
	CatalogSet,
	PackageStateSnapshot,
	PublishabilityDetector,
	WorkspaceDiscovery,
	WorkspaceSnapshots,
	WorkspaceStateSnapshot,
} from "@effected/workspaces";
import { Effect, Layer } from "effect";
// `vi` stays on the plain "vitest" entrypoint: vitest hoists its mock wiring above all
// imports, and a re-exported binding is not initialized in time.
import { vi } from "vitest";
import type { ChangesetIOError } from "../../src/changesets/errors.js";
import { ConfigInspector } from "../../src/changesets/services/config-inspector.js";
import type { RegenPlan } from "../../src/changesets/services/deps-regen.js";
import { DepsRegen, isPureDependencyChangeset } from "../../src/changesets/services/deps-regen.js";
import type { WorkspaceDependencyDiff } from "../../src/changesets/utils/dep-diff.js";
import { ChangesetConfig } from "../../src/services/ChangesetConfig.js";

/**
 * Build a {@link WorkspaceStateSnapshot} from plain package/catalog literals.
 * NEVER resolves against the host workspace — every catalog and version is
 * declared inline here.
 */
const wss = (
	packages: ReadonlyArray<{
		name: string;
		version?: string;
		relativePath: string;
		dependencies?: Record<string, string>;
	}>,
	catalogs: Record<string, Record<string, string>> = {},
): WorkspaceStateSnapshot =>
	new WorkspaceStateSnapshot({
		packages: packages.map(
			(p) =>
				new PackageStateSnapshot({
					name: p.name,
					version: p.version ?? "1.0.0",
					relativePath: p.relativePath,
					dependencies: p.dependencies ?? {},
				}),
		),
		catalogs: CatalogSet.fromCatalogs(catalogs),
	});

/**
 * A `WorkspaceSnapshots` stub. `at("BEFORE")` → before snapshot; any other
 * ref (including the `to` ref used in these tests) and `worktree()` → after
 * snapshot. Canned snapshots carry their own catalogs, so specifier
 * resolution is exercised end-to-end without a live resolver.
 */
const pitStub = (before: WorkspaceStateSnapshot, after: WorkspaceStateSnapshot): Layer.Layer<WorkspaceSnapshots> =>
	Layer.succeed(WorkspaceSnapshots, {
		at: (ref: string) => Effect.succeed(ref === "BEFORE" ? before : after),
		worktree: () => Effect.succeed(after),
	} as never);

describe("DepsRegen changeset detection", () => {
	it("classifies a single-package Dependencies-only changeset as pure", () => {
		const md = ["---", '"@scope/foo": patch', "---", "", "## Dependencies", "", "(table)"].join("\n");
		expect(isPureDependencyChangeset(md)).toEqual({ isPure: true, package: "@scope/foo" });
	});
	it("classifies a changeset with extra sections as not pure", () => {
		const md = ["---", '"@scope/foo": patch', "---", "", "## Dependencies", "", "x", "", "## Features", "", "y"].join(
			"\n",
		);
		expect(isPureDependencyChangeset(md).isPure).toBe(false);
	});
});

// configStub — model: SilkPublishability.test.ts:53.
const configStub = (opts: { versionPrivate: boolean; ignored: ReadonlyArray<string> }) =>
	Layer.succeed(ChangesetConfig, {
		mode: () => Effect.succeed("silk" as const),
		versionPrivate: () => Effect.succeed(opts.versionPrivate),
		ignorePatterns: () => Effect.succeed(opts.ignored),
		isIgnored: (name: string) => Effect.succeed(opts.ignored.includes(name)),
		fixed: () => Effect.succeed([]),
		refresh: () => Effect.void,
	} as never);

describe("DepsRegen plan/execute", () => {
	// @scope/foo bumps effect and adopts @savvy-web/cli via catalog:silk; the
	// after snapshot's `silk` catalog resolves that to a concrete 1.2.3.
	const before = wss([{ name: "@scope/foo", relativePath: "packages/foo", dependencies: { effect: "3.18.0" } }]);
	const after = wss(
		[
			{
				name: "@scope/foo",
				relativePath: "packages/foo",
				dependencies: { effect: "3.19.0", "@savvy-web/cli": "catalog:silk" },
			},
		],
		{ silk: { "@savvy-web/cli": "1.2.3" } },
	);

	const PitLayer = pitStub(before, after);
	const InspectorLayer = Layer.succeed(ConfigInspector, {
		inspect: () => Effect.succeed({ baseBranch: "main" }),
		classify: () => Effect.succeed([]),
		refresh: () => Effect.void,
	} as never);
	const DiscoveryLayer = Layer.succeed(WorkspaceDiscovery, {
		listPackages: () => Effect.succeed([{ name: "@scope/foo", path: "/x/packages/foo", version: "1.0.0" }]),
		refresh: () => Effect.void,
	} as never);
	const DetectorLayer = Layer.succeed(PublishabilityDetector, {
		detect: () => Effect.succeed([{}]),
	} as never);

	// Default gating config for these pre-existing tests: no versionPrivate, no
	// ignores — preserves today's publishable-only behavior unchanged.
	const deps = Layer.mergeAll(
		PitLayer,
		InspectorLayer,
		DiscoveryLayer,
		DetectorLayer,
		configStub({ versionPrivate: false, ignored: [] }),
	);
	const live = DepsRegen.layer.pipe(Layer.provide(deps), Layer.provide(Git.layer));

	const cannedDiff: WorkspaceDependencyDiff = {
		package: "@x/a",
		relativePath: "packages/a",
		rows: [{ dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.0" }],
	};

	it.effect("plans stale deletes + fresh writes (resolving catalog: rows), then execute applies them", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "depsregen-"));
			const csDir = join(dir, ".changeset");
			mkdirSync(csDir);
			const staleFile = join(csDir, "stale-old-changeset.md");
			writeFileSync(
				staleFile,
				["---", '"@scope/foo": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
			);
			const mixedFile = join(csDir, "mixed.md");
			writeFileSync(
				mixedFile,
				["---", '"@scope/foo": patch', "---", "", "## Dependencies", "", "x", "", "## Features", "", "y", ""].join(
					"\n",
				),
			);

			const program = Effect.gen(function* () {
				const svc = yield* DepsRegen;
				const plan = yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER" });
				const result = yield* svc.execute(plan);
				return { plan, result };
			});

			const { plan, result } = yield* program.pipe(Effect.provide(live), Effect.provide(NodeServices.layer));

			expect(plan.toWrite).toHaveLength(1);
			expect(plan.toWrite[0]?.package).toBe("@scope/foo");
			const rows = plan.toWrite[0]?.diff.rows ?? [];
			expect(rows.find((r) => r.dependency === "@savvy-web/cli")?.to).toBe("1.2.3");
			expect(plan.toDelete.map((d) => d.file)).toContain(staleFile);
			expect(plan.skippedMixed).toContain(mixedFile);

			expect(result.deleted).toContain(staleFile);
			expect(existsSync(staleFile)).toBe(false);
			expect(result.written).toHaveLength(1);
			expect(existsSync(result.written[0] as string)).toBe(true);
		}),
	);

	it.effect(
		"plan() picks DISTINCT changeset filenames for two changed packages, even under a forced RNG collision",
		() =>
			Effect.gen(function* () {
				const dir = mkdtempSync(join(tmpdir(), "depsregen-multi-"));
				const csDir = join(dir, ".changeset");
				mkdirSync(csDir);

				const mkMultiSnap = (effectVersion: string) =>
					wss([
						{ name: "@scope/foo", relativePath: "packages/foo", dependencies: { effect: effectVersion } },
						{ name: "@scope/bar", relativePath: "packages/bar", dependencies: { effect: effectVersion } },
					]);
				const beforeMulti = mkMultiSnap("3.18.0");
				const afterMulti = mkMultiSnap("3.19.0");

				const DiscoveryLayerMulti = Layer.succeed(WorkspaceDiscovery, {
					listPackages: () =>
						Effect.succeed([
							{ name: "@scope/foo", path: "/x/packages/foo", version: "1.0.0" },
							{ name: "@scope/bar", path: "/x/packages/bar", version: "1.0.0" },
						]),
					refresh: () => Effect.void,
				} as never);
				const DetectorLayerMulti = Layer.succeed(PublishabilityDetector, {
					detect: () => Effect.succeed([{}]),
				} as never);

				const depsMulti = Layer.mergeAll(
					pitStub(beforeMulti, afterMulti),
					InspectorLayer,
					DiscoveryLayerMulti,
					DetectorLayerMulti,
					configStub({ versionPrivate: false, ignored: [] }),
				);
				const liveMulti = DepsRegen.layer.pipe(Layer.provide(depsMulti), Layer.provide(Git.layer));

				// Force every `pickRandomTriplet()` pick to be identical so a filename
				// collision between the two changed packages is deterministic rather
				// than left to chance (1-in-1000 odds would make this test flaky).
				const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
				try {
					const program = Effect.gen(function* () {
						const svc = yield* DepsRegen;
						return yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER" });
					});
					const plan = yield* program.pipe(Effect.provide(liveMulti), Effect.provide(NodeServices.layer));

					expect(plan.toWrite).toHaveLength(2);
					const basenames = plan.toWrite.map((w) => basename(w.file));
					expect(new Set(basenames).size).toBe(basenames.length);
				} finally {
					randomSpy.mockRestore();
				}
			}),
	);

	it.effect("execute fails loudly with ChangesetIOError when a write cannot land", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "depsregen-io-"));
			const plan: RegenPlan = {
				toDelete: [],
				toWrite: [{ file: join(dir, "no-such-subdir", "brave-dogs-laugh.md"), package: "@x/a", diff: cannedDiff }],
				skippedMixed: [],
				coexisting: [],
			};
			const result = yield* Effect.gen(function* () {
				const svc = yield* DepsRegen;
				return yield* svc.execute(plan).pipe(Effect.flip);
			}).pipe(Effect.provide(live), Effect.provide(NodeServices.layer));
			expect(result._tag).toBe("ChangesetIOError");
			expect((result as ChangesetIOError).operation).toBe("write");
		}),
	);

	it.effect("execute tolerates delete failures and still reports written files", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "depsregen-io-"));
			const plan: RegenPlan = {
				toDelete: [{ file: join(dir, "never-existed.md"), package: "@x/a" }],
				toWrite: [{ file: join(dir, "calm-owls-sing.md"), package: "@x/a", diff: cannedDiff }],
				skippedMixed: [],
				coexisting: [],
			};
			const result = yield* Effect.gen(function* () {
				const svc = yield* DepsRegen;
				return yield* svc.execute(plan);
			}).pipe(Effect.provide(live), Effect.provide(NodeServices.layer));
			expect(result.written).toEqual([join(dir, "calm-owls-sing.md")]);
			expect(result.deleted).toEqual([]);
			expect(existsSync(join(dir, "calm-owls-sing.md"))).toBe(true);
		}),
	);
});

describe("DepsRegen — coexisting prose changesets are surfaced, not silently invisible (#279)", () => {
	// Same before/after as the main suite: @scope/foo has a real dependency diff.
	const before = wss([{ name: "@scope/foo", relativePath: "packages/foo", dependencies: { effect: "3.18.0" } }]);
	const after = wss([{ name: "@scope/foo", relativePath: "packages/foo", dependencies: { effect: "3.19.0" } }]);
	const InspectorLayer = Layer.succeed(ConfigInspector, {
		inspect: () => Effect.succeed({ baseBranch: "main" }),
		classify: () => Effect.succeed([]),
		refresh: () => Effect.void,
	} as never);
	const DiscoveryLayer = Layer.succeed(WorkspaceDiscovery, {
		listPackages: () => Effect.succeed([{ name: "@scope/foo", path: "/x/packages/foo", version: "1.0.0" }]),
		refresh: () => Effect.void,
	} as never);
	const DetectorLayer = Layer.succeed(PublishabilityDetector, {
		detect: () => Effect.succeed([{}]),
	} as never);
	const live = DepsRegen.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				pitStub(before, after),
				InspectorLayer,
				DiscoveryLayer,
				DetectorLayer,
				configStub({ versionPrivate: false, ignored: [] }),
			),
		),
		Layer.provide(Git.layer),
	);

	it.effect("plan() and execute() report an untouched prose changeset referencing an in-scope package", () => {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-coexist-"));
		const csDir = join(dir, ".changeset");
		mkdirSync(csDir);
		// Prose-only changeset for the in-scope package: no Dependencies section,
		// so it is neither pure (delete candidate) nor mixed (skippedMixed).
		const proseFile = join(csDir, "sweet-cooks-guess.md");
		writeFileSync(
			proseFile,
			["---", '"@scope/foo": minor', "---", "", "## Features", "", "Adds a thing.", ""].join("\n"),
		);
		// Prose changeset for a package NOT in scope for this run — must not appear.
		const outOfScopeFile = join(csDir, "other-pkg-prose.md");
		writeFileSync(
			outOfScopeFile,
			["---", '"@scope/unrelated": patch', "---", "", "## Fixes", "", "Unrelated.", ""].join("\n"),
		);

		return Effect.gen(function* () {
			const { plan, result } = yield* Effect.gen(function* () {
				const svc = yield* DepsRegen;
				const plan = yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER" });
				const result = yield* svc.execute(plan);
				return { plan, result };
			}).pipe(Effect.provide(live), Effect.provide(NodeServices.layer));

			expect(plan.coexisting).toEqual([{ file: proseFile, packages: ["@scope/foo"] }]);
			expect(result.coexisting).toEqual([{ file: proseFile, packages: ["@scope/foo"] }]);
			// Untouched: not deleted, not written over, not classified as mixed.
			expect(plan.toDelete.map((d) => d.file)).not.toContain(proseFile);
			expect(plan.skippedMixed).not.toContain(proseFile);
			expect(existsSync(proseFile)).toBe(true);
			expect(existsSync(outOfScopeFile)).toBe(true);
		}).pipe(Effect.ensuring(Effect.sync(() => rmSync(dir, { recursive: true, force: true }))));
	});

	it.effect(
		"classifies a prose changeset whose fenced code block CONTAINS '## Dependencies' as prose, not mixed",
		() => {
			const dir = mkdtempSync(join(tmpdir(), "depsregen-fence-"));
			const csDir = join(dir, ".changeset");
			mkdirSync(csDir);
			// A prose changeset DOCUMENTING the changeset format: the Dependencies
			// heading appears only inside a fenced ```markdown block. A fence-blind
			// detector misreads it as a mixed dependency changeset and drops it from
			// the coexisting bucket.
			const proseFile = join(csDir, "docs-about-format.md");
			writeFileSync(
				proseFile,
				[
					"---",
					'"@scope/foo": minor',
					"---",
					"",
					"## Documentation",
					"",
					"Documents the dependency-changeset format:",
					"",
					"```markdown",
					"## Dependencies",
					"",
					"| Dependency | Type | Action | From | To |",
					"```",
					"",
				].join("\n"),
			);

			return Effect.gen(function* () {
				const plan = yield* Effect.gen(function* () {
					const svc = yield* DepsRegen;
					return yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER" });
				}).pipe(Effect.provide(live), Effect.provide(NodeServices.layer));

				// Prose-only: surfaced in coexisting, never classified mixed.
				expect(plan.coexisting).toEqual([{ file: proseFile, packages: ["@scope/foo"] }]);
				expect(plan.skippedMixed).not.toContain(proseFile);
			}).pipe(Effect.ensuring(Effect.sync(() => rmSync(dir, { recursive: true, force: true }))));
		},
	);
});

describe("DepsRegen — devDependency-only diffs must not delete pure changesets (#258)", () => {
	// @scope/foo's ONLY diff row is a devDependency bump, which plan() drops
	// unconditionally (unless includeDevDeps) — so @scope/foo ends up with ZERO
	// resolved rows and is never added to toWrite. A pre-existing pure
	// dependency changeset for @scope/foo must therefore survive: today's bug
	// deletes it anyway because the delete predicate only checked in-scope-ness,
	// not "is this package actually being rewritten this run".
	const mkDevDepOnlySnap = (devDepVersion: string) =>
		new WorkspaceStateSnapshot({
			packages: [
				new PackageStateSnapshot({
					name: "@scope/foo",
					version: "1.0.0",
					relativePath: "packages/foo",
					dependencies: {},
					devDependencies: { "some-dev-tool": devDepVersion },
				}),
			],
			catalogs: CatalogSet.fromCatalogs({}),
		});
	const devDepBefore = mkDevDepOnlySnap("^1.0.0");
	const devDepAfter = mkDevDepOnlySnap("^2.0.0");

	const DevDepPitLayer = pitStub(devDepBefore, devDepAfter);
	const DevDepInspectorLayer = Layer.succeed(ConfigInspector, {
		inspect: () => Effect.succeed({ baseBranch: "main" }),
		classify: () => Effect.succeed([]),
		refresh: () => Effect.void,
	} as never);
	const DevDepDiscoveryLayer = Layer.succeed(WorkspaceDiscovery, {
		listPackages: () => Effect.succeed([{ name: "@scope/foo", path: "/x/packages/foo", version: "1.0.0" }]),
		refresh: () => Effect.void,
	} as never);
	const DevDepDetectorLayer = Layer.succeed(PublishabilityDetector, {
		detect: () => Effect.succeed([{}]),
	} as never);
	const devDeps = Layer.mergeAll(
		DevDepPitLayer,
		DevDepInspectorLayer,
		DevDepDiscoveryLayer,
		DevDepDetectorLayer,
		configStub({ versionPrivate: false, ignored: [] }),
	);
	const devDepLive = DepsRegen.layer.pipe(Layer.provide(devDeps), Layer.provide(Git.layer));

	it.effect("plan() excludes the pre-existing pure changeset from toDelete, and execute() leaves it on disk", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "depsregen-devdep-"));
			const csDir = join(dir, ".changeset");
			mkdirSync(csDir);
			const preExisting = join(csDir, "pre-existing-foo.md");
			writeFileSync(
				preExisting,
				["---", '"@scope/foo": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
			);

			const program = Effect.gen(function* () {
				const svc = yield* DepsRegen;
				const plan = yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER" });
				const result = yield* svc.execute(plan);
				return { plan, result };
			});

			const { plan, result } = yield* program.pipe(Effect.provide(devDepLive), Effect.provide(NodeServices.layer));

			expect(plan.toWrite).toHaveLength(0);
			expect(plan.toDelete.map((d) => d.file)).not.toContain(preExisting);
			expect(result.deleted).not.toContain(preExisting);
			expect(existsSync(preExisting)).toBe(true);
		}),
	);
});

describe("DepsRegen gating matrix — versionable minus ignored (#209)", () => {
	// Two workspace packages: @x/pub is publishable, @x/priv is not. Both have a
	// dependency change in the diff (effect 3.18.0 -> 3.19.0) and both have a
	// pre-existing pure dependency changeset on disk.
	const mkGatingSnap = (effectVersion: string) =>
		wss([
			{ name: "@x/pub", relativePath: "packages/pub", dependencies: { effect: effectVersion } },
			{ name: "@x/priv", relativePath: "packages/priv", dependencies: { effect: effectVersion } },
		]);
	const beforeGating = mkGatingSnap("3.18.0");
	const afterGating = mkGatingSnap("3.19.0");

	const GatingPitLayer = pitStub(beforeGating, afterGating);
	const GatingInspectorLayer = Layer.succeed(ConfigInspector, {
		inspect: () => Effect.succeed({ baseBranch: "main" }),
		classify: () => Effect.succeed([]),
		refresh: () => Effect.void,
	} as never);
	const GatingDiscoveryLayer = Layer.succeed(WorkspaceDiscovery, {
		listPackages: () =>
			Effect.succeed([
				{ name: "@x/pub", path: "/x/packages/pub", version: "1.0.0" },
				{ name: "@x/priv", path: "/x/packages/priv", version: "1.0.0" },
			]),
		refresh: () => Effect.void,
	} as never);
	// Only @x/pub is publishable — @x/priv detects to an empty target list.
	const GatingDetectorLayer = Layer.succeed(PublishabilityDetector, {
		detect: (pkg: { name: string }) => Effect.succeed(pkg.name === "@x/pub" ? [{}] : []),
	} as never);

	/** Build a fresh fixture dir with a pure-dep changeset on disk for both packages. */
	const makeGatingFixture = (): string => {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-gating-"));
		const csDir = join(dir, ".changeset");
		mkdirSync(csDir);
		writeFileSync(
			join(csDir, "stale-pub.md"),
			["---", '"@x/pub": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
		);
		writeFileSync(
			join(csDir, "stale-priv.md"),
			["---", '"@x/priv": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
		);
		return dir;
	};

	// Per-test provide is REQUIRED: `config` is a parameter — each gating case supplies a
	// different mocked ChangesetConfig — and the fixture dir is rebuilt per call.
	const runGatingPlan = (
		config: Layer.Layer<ChangesetConfig>,
		options: {
			readonly package?: string;
			readonly packages?: ReadonlyArray<string>;
			readonly exclude?: ReadonlyArray<string>;
		} = {},
	): Effect.Effect<RegenPlan> => {
		const dir = makeGatingFixture();
		const deps = Layer.mergeAll(
			GatingPitLayer,
			GatingInspectorLayer,
			GatingDiscoveryLayer,
			GatingDetectorLayer,
			config,
		);
		const live = DepsRegen.layer.pipe(Layer.provide(deps), Layer.provide(Git.layer));
		const program = Effect.gen(function* () {
			const svc = yield* DepsRegen;
			return yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER", ...options });
		});
		return program.pipe(Effect.provide(live), Effect.provide(NodeServices.layer)) as Effect.Effect<RegenPlan>;
	};

	const writtenPackages = (plan: RegenPlan) => plan.toWrite.map((w) => w.package).sort();
	const deletedPackages = (plan: RegenPlan) => plan.toDelete.map((d) => d.package).sort();

	it.effect("case 1: versionPrivate false, no ignores -> only the publishable package (today's behavior)", () =>
		Effect.gen(function* () {
			const plan = yield* runGatingPlan(configStub({ versionPrivate: false, ignored: [] }));
			expect(writtenPackages(plan)).toEqual(["@x/pub"]);
			expect(deletedPackages(plan)).toEqual(["@x/pub"]);
		}),
	);

	it.effect("case 2: versionPrivate true, no ignores -> both packages", () =>
		Effect.gen(function* () {
			const plan = yield* runGatingPlan(configStub({ versionPrivate: true, ignored: [] }));
			expect(writtenPackages(plan)).toEqual(["@x/priv", "@x/pub"]);
			expect(deletedPackages(plan)).toEqual(["@x/priv", "@x/pub"]);
		}),
	);

	it.effect("case 3: versionPrivate true, @x/pub ignored -> only @x/priv (ignore beats publishable)", () =>
		Effect.gen(function* () {
			const plan = yield* runGatingPlan(configStub({ versionPrivate: true, ignored: ["@x/pub"] }));
			expect(writtenPackages(plan)).toEqual(["@x/priv"]);
			expect(deletedPackages(plan)).toEqual(["@x/priv"]);
		}),
	);

	it.effect("case 4: versionPrivate true, @x/priv ignored -> only @x/pub (ignore beats versionPrivate)", () =>
		Effect.gen(function* () {
			const plan = yield* runGatingPlan(configStub({ versionPrivate: true, ignored: ["@x/priv"] }));
			expect(writtenPackages(plan)).toEqual(["@x/pub"]);
			expect(deletedPackages(plan)).toEqual(["@x/pub"]);
		}),
	);

	it.effect(
		"case 5: explicit --package @x/priv, versionPrivate false, no ignores -> @x/priv (explicit package bypasses versionable)",
		() =>
			Effect.gen(function* () {
				const plan = yield* runGatingPlan(configStub({ versionPrivate: false, ignored: [] }), { package: "@x/priv" });
				expect(writtenPackages(plan)).toEqual(["@x/priv"]);
				expect(deletedPackages(plan)).toEqual(["@x/priv"]);
			}),
	);

	it.effect(
		"case 6: explicit --package @x/priv, @x/priv ignored -> nothing written or deleted (ignore beats explicit package)",
		() =>
			Effect.gen(function* () {
				const plan = yield* runGatingPlan(configStub({ versionPrivate: false, ignored: ["@x/priv"] }), {
					package: "@x/priv",
				});
				expect(writtenPackages(plan)).toEqual([]);
				expect(deletedPackages(plan)).toEqual([]);
			}),
	);

	it.effect("case 7: packages batch include targets both in one call, bypassing versionable (#231)", () =>
		Effect.gen(function* () {
			const plan = yield* runGatingPlan(configStub({ versionPrivate: false, ignored: [] }), {
				packages: ["@x/pub", "@x/priv"],
			});
			expect(writtenPackages(plan)).toEqual(["@x/priv", "@x/pub"]);
			expect(deletedPackages(plan)).toEqual(["@x/priv", "@x/pub"]);
		}),
	);

	it.effect("case 8: repo-wide run with exclude skips the package AND leaves its stale changeset alone (#231)", () =>
		Effect.gen(function* () {
			const plan = yield* runGatingPlan(configStub({ versionPrivate: true, ignored: [] }), {
				exclude: ["@x/priv"],
			});
			expect(writtenPackages(plan)).toEqual(["@x/pub"]);
			expect(deletedPackages(plan)).toEqual(["@x/pub"]);
		}),
	);

	it.effect("case 9: exclude wins over an explicit packages include (#231)", () =>
		Effect.gen(function* () {
			const plan = yield* runGatingPlan(configStub({ versionPrivate: false, ignored: [] }), {
				packages: ["@x/pub", "@x/priv"],
				exclude: ["@x/priv"],
			});
			expect(writtenPackages(plan)).toEqual(["@x/pub"]);
			expect(deletedPackages(plan)).toEqual(["@x/pub"]);
		}),
	);

	it.effect("case 10: package and packages union into one target set (#231)", () =>
		Effect.gen(function* () {
			const plan = yield* runGatingPlan(configStub({ versionPrivate: false, ignored: [] }), {
				package: "@x/pub",
				packages: ["@x/priv"],
			});
			expect(writtenPackages(plan)).toEqual(["@x/priv", "@x/pub"]);
			expect(deletedPackages(plan)).toEqual(["@x/priv", "@x/pub"]);
		}),
	);
});

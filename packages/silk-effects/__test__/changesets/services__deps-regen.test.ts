import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
	CatalogSet,
	PackageStateSnapshot,
	PointInTimeWorkspace,
	PublishabilityDetector,
	WorkspaceDiscovery,
	WorkspaceStateSnapshot,
} from "workspaces-effect";
import type { ChangesetIOError } from "../../src/changesets/errors.js";
import { ConfigInspector } from "../../src/changesets/services/config-inspector.js";
import type { RegenPlan } from "../../src/changesets/services/deps-regen.js";
import { DepsRegen, DepsRegenLive, isPureDependencyChangeset } from "../../src/changesets/services/deps-regen.js";
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
 * A `PointInTimeWorkspace` stub. `at("BEFORE")` → before snapshot; any other
 * ref (including the `to` ref used in these tests) and `worktree()` → after
 * snapshot. Canned snapshots carry their own catalogs, so specifier
 * resolution is exercised end-to-end without a live resolver.
 */
const pitStub = (before: WorkspaceStateSnapshot, after: WorkspaceStateSnapshot): Layer.Layer<PointInTimeWorkspace> =>
	Layer.succeed(PointInTimeWorkspace, {
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
	} as never);
	const DiscoveryLayer = Layer.succeed(WorkspaceDiscovery, {
		listPackages: () => Effect.succeed([{ name: "@scope/foo", path: "/x/packages/foo", version: "1.0.0" }]),
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
	const live = DepsRegenLive.pipe(Layer.provide(deps));

	const cannedDiff: WorkspaceDependencyDiff = {
		package: "@x/a",
		relativePath: "packages/a",
		rows: [{ dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.0" }],
	};

	it("plans stale deletes + fresh writes (resolving catalog: rows), then execute applies them", async () => {
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
			["---", '"@scope/foo": patch', "---", "", "## Dependencies", "", "x", "", "## Features", "", "y", ""].join("\n"),
		);

		const program = Effect.gen(function* () {
			const svc = yield* DepsRegen;
			const plan = yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER" });
			const result = yield* svc.execute(plan);
			return { plan, result };
		});

		const { plan, result } = await Effect.runPromise(
			program.pipe(Effect.provide(live), Effect.provide(NodeContext.layer)),
		);

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
	});

	it("plan() picks DISTINCT changeset filenames for two changed packages, even under a forced RNG collision", async () => {
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
		const liveMulti = DepsRegenLive.pipe(Layer.provide(depsMulti));

		// Force every `pickRandomTriplet()` pick to be identical so a filename
		// collision between the two changed packages is deterministic rather
		// than left to chance (1-in-1000 odds would make this test flaky).
		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
		try {
			const program = Effect.gen(function* () {
				const svc = yield* DepsRegen;
				return yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER" });
			});
			const plan = await Effect.runPromise(program.pipe(Effect.provide(liveMulti), Effect.provide(NodeContext.layer)));

			expect(plan.toWrite).toHaveLength(2);
			const basenames = plan.toWrite.map((w) => basename(w.file));
			expect(new Set(basenames).size).toBe(basenames.length);
		} finally {
			randomSpy.mockRestore();
		}
	});

	it("execute fails loudly with ChangesetIOError when a write cannot land", async () => {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-io-"));
		const plan: RegenPlan = {
			toDelete: [],
			toWrite: [{ file: join(dir, "no-such-subdir", "brave-dogs-laugh.md"), package: "@x/a", diff: cannedDiff }],
			skippedMixed: [],
		};
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* DepsRegen;
				return yield* svc.execute(plan).pipe(Effect.flip);
			}).pipe(Effect.provide(live), Effect.provide(NodeContext.layer)),
		);
		expect(result._tag).toBe("ChangesetIOError");
		expect((result as ChangesetIOError).operation).toBe("write");
	});

	it("execute tolerates delete failures and still reports written files", async () => {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-io-"));
		const plan: RegenPlan = {
			toDelete: [{ file: join(dir, "never-existed.md"), package: "@x/a" }],
			toWrite: [{ file: join(dir, "calm-owls-sing.md"), package: "@x/a", diff: cannedDiff }],
			skippedMixed: [],
		};
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* DepsRegen;
				return yield* svc.execute(plan);
			}).pipe(Effect.provide(live), Effect.provide(NodeContext.layer)),
		);
		expect(result.written).toEqual([join(dir, "calm-owls-sing.md")]);
		expect(result.deleted).toEqual([]);
		expect(existsSync(join(dir, "calm-owls-sing.md"))).toBe(true);
	});
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
	} as never);
	const GatingDiscoveryLayer = Layer.succeed(WorkspaceDiscovery, {
		listPackages: () =>
			Effect.succeed([
				{ name: "@x/pub", path: "/x/packages/pub", version: "1.0.0" },
				{ name: "@x/priv", path: "/x/packages/priv", version: "1.0.0" },
			]),
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

	const runGatingPlan = async (
		config: Layer.Layer<ChangesetConfig>,
		options: { readonly package?: string } = {},
	): Promise<RegenPlan> => {
		const dir = makeGatingFixture();
		const deps = Layer.mergeAll(
			GatingPitLayer,
			GatingInspectorLayer,
			GatingDiscoveryLayer,
			GatingDetectorLayer,
			config,
		);
		const live = DepsRegenLive.pipe(Layer.provide(deps));
		const program = Effect.gen(function* () {
			const svc = yield* DepsRegen;
			return yield* svc.plan({ cwd: dir, from: "BEFORE", to: "AFTER", ...options });
		});
		return Effect.runPromise(program.pipe(Effect.provide(live), Effect.provide(NodeContext.layer)));
	};

	const writtenPackages = (plan: RegenPlan) => plan.toWrite.map((w) => w.package).sort();
	const deletedPackages = (plan: RegenPlan) => plan.toDelete.map((d) => d.package).sort();

	it("case 1: versionPrivate false, no ignores -> only the publishable package (today's behavior)", async () => {
		const plan = await runGatingPlan(configStub({ versionPrivate: false, ignored: [] }));
		expect(writtenPackages(plan)).toEqual(["@x/pub"]);
		expect(deletedPackages(plan)).toEqual(["@x/pub"]);
	});

	it("case 2: versionPrivate true, no ignores -> both packages", async () => {
		const plan = await runGatingPlan(configStub({ versionPrivate: true, ignored: [] }));
		expect(writtenPackages(plan)).toEqual(["@x/priv", "@x/pub"]);
		expect(deletedPackages(plan)).toEqual(["@x/priv", "@x/pub"]);
	});

	it("case 3: versionPrivate true, @x/pub ignored -> only @x/priv (ignore beats publishable)", async () => {
		const plan = await runGatingPlan(configStub({ versionPrivate: true, ignored: ["@x/pub"] }));
		expect(writtenPackages(plan)).toEqual(["@x/priv"]);
		expect(deletedPackages(plan)).toEqual(["@x/priv"]);
	});

	it("case 4: versionPrivate true, @x/priv ignored -> only @x/pub (ignore beats versionPrivate)", async () => {
		const plan = await runGatingPlan(configStub({ versionPrivate: true, ignored: ["@x/priv"] }));
		expect(writtenPackages(plan)).toEqual(["@x/pub"]);
		expect(deletedPackages(plan)).toEqual(["@x/pub"]);
	});

	it("case 5: explicit --package @x/priv, versionPrivate false, no ignores -> @x/priv (explicit package bypasses versionable)", async () => {
		const plan = await runGatingPlan(configStub({ versionPrivate: false, ignored: [] }), { package: "@x/priv" });
		expect(writtenPackages(plan)).toEqual(["@x/priv"]);
		expect(deletedPackages(plan)).toEqual(["@x/priv"]);
	});

	it("case 6: explicit --package @x/priv, @x/priv ignored -> nothing written or deleted (ignore beats explicit package)", async () => {
		const plan = await runGatingPlan(configStub({ versionPrivate: false, ignored: ["@x/priv"] }), {
			package: "@x/priv",
		});
		expect(writtenPackages(plan)).toEqual([]);
		expect(deletedPackages(plan)).toEqual([]);
	});
});

import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { CatalogResolver, PublishabilityDetector, WorkspaceDiscovery } from "workspaces-effect";
import { ConfigInspector } from "../../src/changesets/services/config-inspector.js";
import {
	DepsRegen,
	DepsRegenLive,
	isPureDependencyChangeset,
	resolveDiffRows,
} from "../../src/changesets/services/deps-regen.js";
import { WorkspaceSnapshotReader } from "../../src/changesets/services/workspace-snapshot.js";
import type { WorkspaceDependencyDiff } from "../../src/changesets/utils/dep-diff.js";

// A CatalogResolver test layer: catalog:silk -> 1.2.3, everything else unresolved.
// NEVER resolve against the host workspace — this mock is the only resolver.
const TestResolver = Layer.succeed(CatalogResolver, {
	catalogs: () => Effect.succeed({} as never),
	resolve: (m: never) => Effect.succeed(m),
	resolveSpecifier: (_dep: string, spec: string) =>
		spec === "catalog:silk" ? Effect.succeed(Option.some("1.2.3")) : Effect.succeed(Option.none()),
} as never);

describe("DepsRegen row transforms", () => {
	it("drops devDependency rows unconditionally", async () => {
		const diff: WorkspaceDependencyDiff = {
			package: "@scope/foo",
			relativePath: "packages/foo",
			rows: [
				{ dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.0" },
				{ dependency: "vitest", type: "devDependency", action: "updated", from: "1.0.0", to: "2.0.0" },
			],
		};
		const out = await Effect.runPromise(resolveDiffRows(diff).pipe(Effect.provide(TestResolver)));
		expect(out.rows.map((r) => r.type)).toEqual(["dependency"]);
	});

	it("resolves catalog: specifiers, falling back to the raw string when unresolved", async () => {
		const diff: WorkspaceDependencyDiff = {
			package: "@scope/bar",
			relativePath: "packages/bar",
			rows: [
				{ dependency: "@savvy-web/cli", type: "dependency", action: "added", from: "—", to: "catalog:silk" },
				{ dependency: "@scope/qux", type: "dependency", action: "added", from: "—", to: "workspace:*" },
			],
		};
		const out = await Effect.runPromise(resolveDiffRows(diff).pipe(Effect.provide(TestResolver)));
		expect(out.rows.find((r) => r.dependency === "@savvy-web/cli")?.to).toBe("1.2.3");
		expect(out.rows.find((r) => r.dependency === "@scope/qux")?.to).toBe("workspace:*");
	});

	it("keeps the raw specifier when the catalog resolver fails (T3a)", async () => {
		// A resolver whose resolveSpecifier genuinely FAILS (e.g. a misconfigured
		// pnpm-workspace.yaml catalog) for every protocol cell. Fix 2 must still
		// keep the raw protocol string as a fallback — never blocking the commit.
		const FailingResolver = Layer.succeed(CatalogResolver, {
			catalogs: () => Effect.succeed({} as never),
			resolve: (m: never) => Effect.succeed(m),
			resolveSpecifier: (_dep: string, _spec: string) => Effect.fail(new Error("catalog resolution error")),
		} as never);

		const diff: WorkspaceDependencyDiff = {
			package: "@scope/broken",
			relativePath: "packages/broken",
			rows: [{ dependency: "@scope/qux", type: "dependency", action: "added", from: "—", to: "catalog:silk" }],
		};
		const out = await Effect.runPromise(resolveDiffRows(diff).pipe(Effect.provide(FailingResolver)));
		expect(out.rows.find((r) => r.dependency === "@scope/qux")?.to).toBe("catalog:silk");
	});

	it("keeps devDependency rows when keepDevDeps is true", async () => {
		const diff: WorkspaceDependencyDiff = {
			package: "@scope/foo",
			relativePath: "packages/foo",
			rows: [
				{ dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.0" },
				{ dependency: "vitest", type: "devDependency", action: "updated", from: "1.0.0", to: "2.0.0" },
			],
		};
		const out = await Effect.runPromise(resolveDiffRows(diff, true).pipe(Effect.provide(TestResolver)));
		expect(out.rows.map((r) => r.type).sort()).toEqual(["dependency", "devDependency"]);
	});
});

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

describe("DepsRegen plan/execute", () => {
	const mkSnap = (deps: Record<string, string>) => [
		{
			name: "@scope/foo",
			relativePath: "packages/foo",
			version: "1.0.0",
			dependencies: deps,
			devDependencies: {},
			peerDependencies: {},
			optionalDependencies: {},
		},
	];
	const beforeSnap = mkSnap({ effect: "3.18.0" });
	const afterSnap = mkSnap({ effect: "3.19.0", "@savvy-web/cli": "catalog:silk" });

	const ReaderLayer = Layer.succeed(WorkspaceSnapshotReader, {
		snapshotAt: (_cwd: string, ref: string) => Effect.succeed(ref === "BEFORE" ? beforeSnap : afterSnap),
	} as never);
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

	const deps = Layer.mergeAll(ReaderLayer, InspectorLayer, DiscoveryLayer, DetectorLayer, TestResolver);
	const live = DepsRegenLive.pipe(Layer.provide(deps));

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

		const { plan, result } = await Effect.runPromise(program.pipe(Effect.provide(live)));

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

		const mkMultiSnap = (effectVersion: string) => [
			{
				name: "@scope/foo",
				relativePath: "packages/foo",
				version: "1.0.0",
				dependencies: { effect: effectVersion },
				devDependencies: {},
				peerDependencies: {},
				optionalDependencies: {},
			},
			{
				name: "@scope/bar",
				relativePath: "packages/bar",
				version: "1.0.0",
				dependencies: { effect: effectVersion },
				devDependencies: {},
				peerDependencies: {},
				optionalDependencies: {},
			},
		];
		const beforeSnapMulti = mkMultiSnap("3.18.0");
		const afterSnapMulti = mkMultiSnap("3.19.0");

		const ReaderLayerMulti = Layer.succeed(WorkspaceSnapshotReader, {
			snapshotAt: (_cwd: string, ref: string) => Effect.succeed(ref === "BEFORE" ? beforeSnapMulti : afterSnapMulti),
		} as never);
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
			ReaderLayerMulti,
			InspectorLayer,
			DiscoveryLayerMulti,
			DetectorLayerMulti,
			TestResolver,
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
			const plan = await Effect.runPromise(program.pipe(Effect.provide(liveMulti)));

			expect(plan.toWrite).toHaveLength(2);
			const basenames = plan.toWrite.map((w) => basename(w.file));
			expect(new Set(basenames).size).toBe(basenames.length);
		} finally {
			randomSpy.mockRestore();
		}
	});
});

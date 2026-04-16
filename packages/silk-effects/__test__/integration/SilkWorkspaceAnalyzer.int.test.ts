import { resolve } from "node:path";
import { Path } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";
import {
	DependencyGraphLive,
	PackageManagerDetector,
	PackageManagerDetectorLive,
	TopologicalSorterLive,
	WorkspaceDiscoveryLive,
	WorkspaceRoot,
} from "workspaces-effect";
import type { AnalyzedWorkspace } from "../../src/schemas/WorkspaceAnalysisSchemas.js";
import { ChangesetConfigReaderLive } from "../../src/services/ChangesetConfigReader.js";
import { SilkPublishabilityPluginLive } from "../../src/services/SilkPublishabilityPlugin.js";
import { SilkWorkspaceAnalyzer, SilkWorkspaceAnalyzerLive } from "../../src/services/SilkWorkspaceAnalyzer.js";
import { TagStrategyLive } from "../../src/services/TagStrategy.js";
import { TargetResolverLive } from "../../src/services/TargetResolver.js";
import { VersioningStrategyLive } from "../../src/services/VersioningStrategy.js";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const FIXTURES = resolve(import.meta.dirname, "fixtures/workspaces");
const fixtureRoot = (...segments: string[]) => resolve(FIXTURES, ...segments);

const platform = Layer.mergeAll(NodeFileSystem.layer, Path.layer, Logger.replace(Logger.defaultLogger, Logger.none));

/**
 * Create a mock PackageManagerDetector for fixtures that lack lockfiles.
 * Without a lockfile the real detector either falls back to "npm" (when a
 * `workspaces` field exists) or fails entirely (standalone packages).
 */
const mockPM = (type: "npm" | "pnpm" | "yarn" | "bun" = "npm", runtime: "node" | "bun" = "node") =>
	Layer.succeed(PackageManagerDetector, {
		detect: () => Effect.succeed({ type, version: undefined, runtime }),
	});

/**
 * Build the full test layer for a given fixture root.
 *
 * @param fixturePath — absolute path to the fixture directory
 * @param pmLayer — optional mock PM layer; when omitted the real detector is used
 */
const makeTestLayer = (fixturePath: string, pmLayer?: Layer.Layer<PackageManagerDetector>) => {
	const mockRoot = Layer.succeed(WorkspaceRoot, {
		find: () => Effect.succeed(fixturePath),
	});

	const discovery = WorkspaceDiscoveryLive.pipe(Layer.provide(Layer.merge(mockRoot, platform)));

	const pm = pmLayer ?? PackageManagerDetectorLive.pipe(Layer.provide(platform));

	const publishability = SilkPublishabilityPluginLive.pipe(Layer.provide(TargetResolverLive));

	const changesetReader = ChangesetConfigReaderLive.pipe(Layer.provide(platform));

	const versioning = VersioningStrategyLive.pipe(Layer.provide(changesetReader));

	const depGraph = DependencyGraphLive.pipe(Layer.provide(discovery));
	const topoSorter = TopologicalSorterLive.pipe(Layer.provide(depGraph));

	return SilkWorkspaceAnalyzerLive.pipe(
		Layer.provide(
			Layer.mergeAll(platform, discovery, topoSorter, pm, publishability, changesetReader, versioning, TagStrategyLive),
		),
	);
};

/**
 * Run the analyzer against a fixture and return the WorkspaceAnalysis.
 */
const analyze = (fixturePath: string, pmLayer?: Layer.Layer<PackageManagerDetector>) =>
	Effect.runPromise(
		SilkWorkspaceAnalyzer.pipe(
			Effect.andThen((analyzer) => analyzer.analyze(fixturePath)),
			Effect.provide(makeTestLayer(fixturePath, pmLayer)),
		),
	);

// ===========================================================================
// Tests
// ===========================================================================

describe("SilkWorkspaceAnalyzer integration", () => {
	// -----------------------------------------------------------------------
	// standalone
	// -----------------------------------------------------------------------
	describe("standalone", () => {
		describe("default", () => {
			it("private: single workspace, not publishable", async () => {
				const root = fixtureRoot("standalone/default/private");
				const result = await analyze(root, mockPM("npm"));

				expect(result.workspaces).toHaveLength(1);
				expect(result.runtime).toBe("node");
				expect(result.packageManager.type).toBe("npm");
				expect(result.changesetConfig).toBeNull();
				expect(result.isSilk).toBe(false);
				expect(result.hasChangesets).toBe(false);

				const ws = Option.getOrThrow(result.rootWorkspace);
				expect(ws.root).toBe(true);
				expect(ws.name).toBe("private-pkg");
				expect(ws.publishable).toBe(false);
				expect(ws.targets).toHaveLength(0);
				expect(ws.versioned).toBe(false);
				expect(ws.tagged).toBe(false);
				expect(ws.released).toBe(false);
			});

			it("not-publishable: public package without publishConfig", async () => {
				const root = fixtureRoot("standalone/default/not-publishable");
				const result = await analyze(root, mockPM("npm"));

				expect(result.workspaces).toHaveLength(1);

				const ws = Option.getOrThrow(result.rootWorkspace);
				expect(ws.name).toBe("not-publishable-pkg");
				expect(ws.publishable).toBe(false);
				expect(ws.targets).toHaveLength(0);
			});

			it("npm-target: publishable with default npm target", async () => {
				const root = fixtureRoot("standalone/default/npm-target");
				const result = await analyze(root, mockPM("npm"));

				expect(result.workspaces).toHaveLength(1);

				const ws = Option.getOrThrow(result.rootWorkspace);
				expect(ws.name).toBe("npm-target-pkg");
				expect(ws.publishable).toBe(true);
				expect(ws.targets).toHaveLength(1);
				expect(ws.targets[0].registry).toBe("https://registry.npmjs.org/");
				expect(ws.targets[0].protocol).toBe("npm");
			});

			it("multi-target: publishable with two object targets", async () => {
				const root = fixtureRoot("standalone/default/multi-target");
				const result = await analyze(root, mockPM("npm"));

				expect(result.workspaces).toHaveLength(1);

				const ws = Option.getOrThrow(result.rootWorkspace);
				expect(ws.name).toBe("multi-target-pkg");
				expect(ws.publishable).toBe(true);
				expect(ws.targets).toHaveLength(2);

				const registries = ws.targets.map((t) => t.registry);
				expect(registries).toContain("https://npm.pkg.github.com/");
				expect(registries).toContain("https://registry.npmjs.org/");
			});

			it("custom-registry: publishable with custom registry URL", async () => {
				const root = fixtureRoot("standalone/default/custom-registry");
				const result = await analyze(root, mockPM("npm"));

				expect(result.workspaces).toHaveLength(1);

				const ws = Option.getOrThrow(result.rootWorkspace);
				expect(ws.name).toBe("custom-registry-pkg");
				expect(ws.publishable).toBe(true);
				expect(ws.targets).toHaveLength(1);
				expect(ws.targets[0].registry).toBe("https://custom.registry.com/");
			});
		});

		describe("silk", () => {
			it("single: publishable with changeset config, fully released", async () => {
				const root = fixtureRoot("standalone/silk/single");
				const result = await analyze(root, mockPM("npm"));

				expect(result.workspaces).toHaveLength(1);
				expect(result.hasChangesets).toBe(true);
				expect(result.isSilk).toBe(true);

				const ws = Option.getOrThrow(result.rootWorkspace);
				expect(ws.name).toBe("silk-standalone-pkg");
				expect(ws.publishable).toBe(true);
				expect(ws.targets).toHaveLength(1);
				// Private package with privatePackages: { tag: true, version: true }
				expect(ws.versioned).toBe(true);
				expect(ws.tagged).toBe(true);
				expect(ws.released).toBe(true);

				// Versioning strategy should be "single"
				expect(result.versioning).toMatchObject({
					type: "single",
				});

				// Tag strategy should be "single"
				expect(result.tagStrategy).toBe("single");
			});
		});
	});

	// -----------------------------------------------------------------------
	// node/pnpm
	// -----------------------------------------------------------------------
	describe("node/pnpm", () => {
		describe("default", () => {
			it("basic: discovers root + 9 packages with various publishConfig", async () => {
				const root = fixtureRoot("node/pnpm/default/basic");
				const result = await analyze(root);

				expect(result.runtime).toBe("node");
				expect(result.packageManager.type).toBe("pnpm");
				expect(result.changesetConfig).toBeNull();
				expect(result.isSilk).toBe(false);

				// root + 9 workspace packages
				expect(result.workspaces).toHaveLength(10);

				// Root is private, not publishable
				const rootWs = Option.getOrThrow(result.rootWorkspace);
				expect(rootWs.name).toBe("pnpm-basic-monorepo");
				expect(rootWs.root).toBe(true);
				expect(rootWs.publishable).toBe(false);

				// @scope/app: private + publishConfig.access → publishable
				const app = result.findWorkspace("@scope/app");
				expect(Option.isSome(app)).toBe(true);
				const appWs = Option.getOrThrow(app);
				expect(appWs.publishable).toBe(true);
				expect(appWs.targets).toHaveLength(1);

				// @scope/internal: private, no publishConfig → not publishable
				const internal = result.findWorkspace("@scope/internal");
				expect(Option.isSome(internal)).toBe(true);
				expect(Option.getOrThrow(internal).publishable).toBe(false);

				// @scope/lib-npm: private + access → publishable via default "npm"
				const libNpm = Option.getOrThrow(result.findWorkspace("@scope/lib-npm"));
				expect(libNpm.publishable).toBe(true);
				expect(libNpm.targets).toHaveLength(1);
				expect(libNpm.targets[0].registry).toBe("https://registry.npmjs.org/");

				// @scope/lib-multi: targets ["npm","github"] → 2 targets
				const libMulti = Option.getOrThrow(result.findWorkspace("@scope/lib-multi"));
				expect(libMulti.publishable).toBe(true);
				expect(libMulti.targets).toHaveLength(2);

				// @scope/lib-triple: targets ["npm","github","jsr"] → 3 targets
				const libTriple = Option.getOrThrow(result.findWorkspace("@scope/lib-triple"));
				expect(libTriple.publishable).toBe(true);
				expect(libTriple.targets).toHaveLength(3);

				// @scope/lib-objects: object targets → 2 targets
				const libObjects = Option.getOrThrow(result.findWorkspace("@scope/lib-objects"));
				expect(libObjects.publishable).toBe(true);
				expect(libObjects.targets).toHaveLength(2);

				// @scope/lib-custom: publishConfig.registry → custom registry
				const libCustom = Option.getOrThrow(result.findWorkspace("@scope/lib-custom"));
				expect(libCustom.publishable).toBe(true);
				expect(libCustom.targets).toHaveLength(1);
				expect(libCustom.targets[0].registry).toBe("https://custom.registry.com/");

				// @scope/lib-minimal: no private, no publishConfig → not publishable
				const libMinimal = Option.getOrThrow(result.findWorkspace("@scope/lib-minimal"));
				expect(libMinimal.publishable).toBe(false);

				// @scope/lib-link: private + access + linkDirectory → publishable
				const libLink = Option.getOrThrow(result.findWorkspace("@scope/lib-link"));
				expect(libLink.publishable).toBe(true);
			});

			it("root-as-package: root is the only workspace (no duplication)", async () => {
				const root = fixtureRoot("node/pnpm/default/root-as-package");
				const result = await analyze(root);

				// pnpm-workspace.yaml has "." — root listed once
				expect(result.workspaces).toHaveLength(1);

				const ws = Option.getOrThrow(result.rootWorkspace);
				expect(ws.name).toBe("root-only-pkg");
				expect(ws.root).toBe(true);
				expect(ws.publishable).toBe(true);
			});

			it("multi-root: discovers from packages/* and apps/*", async () => {
				const root = fixtureRoot("node/pnpm/default/multi-root");
				const result = await analyze(root);

				// root + lib-a + web = 3
				expect(result.workspaces).toHaveLength(3);

				const rootWs = Option.getOrThrow(result.rootWorkspace);
				expect(rootWs.name).toBe("multi-root-monorepo");

				// @scope/lib-a: publishable
				const libA = Option.getOrThrow(result.findWorkspace("@scope/lib-a"));
				expect(libA.publishable).toBe(true);

				// @scope/web: private, no publishConfig → not publishable
				const web = Option.getOrThrow(result.findWorkspace("@scope/web"));
				expect(web.publishable).toBe(false);
			});

			it("explicit-paths: discovers only named paths", async () => {
				const root = fixtureRoot("node/pnpm/default/explicit-paths");
				const result = await analyze(root);

				// root + foo + bar = 3
				expect(result.workspaces).toHaveLength(3);

				expect(Option.isSome(result.findWorkspace("@scope/foo"))).toBe(true);
				expect(Option.isSome(result.findWorkspace("@scope/bar"))).toBe(true);
			});
		});

		describe("silk", () => {
			it("single: versioning.type='single', single publishable package", async () => {
				const root = fixtureRoot("node/pnpm/silk/single");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);
				expect(result.isSilk).toBe(true);
				expect(result.packageManager.type).toBe("pnpm");

				// root + lib = 2
				expect(result.workspaces).toHaveLength(2);

				// @scope/single-lib is the sole publishable package
				const lib = Option.getOrThrow(result.findWorkspace("@scope/single-lib"));
				expect(lib.publishable).toBe(true);
				expect(lib.versioned).toBe(true);
				expect(lib.tagged).toBe(true);
				expect(lib.released).toBe(true);

				expect(result.versioning).toMatchObject({
					type: "single",
					publishablePackages: ["@scope/single-lib"],
				});
				expect(result.tagStrategy).toBe("single");
			});

			it("fixed-group: all publishable packages in one fixed group", async () => {
				const root = fixtureRoot("node/pnpm/silk/fixed-group");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);
				expect(result.isSilk).toBe(true);

				// root + pkg-a + pkg-b + pkg-c = 4
				expect(result.workspaces).toHaveLength(4);

				const pkgA = Option.getOrThrow(result.findWorkspace("@scope/pkg-a"));
				const pkgB = Option.getOrThrow(result.findWorkspace("@scope/pkg-b"));
				const pkgC = Option.getOrThrow(result.findWorkspace("@scope/pkg-c"));

				// All publishable and released
				for (const ws of [pkgA, pkgB, pkgC]) {
					expect(ws.publishable).toBe(true);
					expect(ws.versioned).toBe(true);
					expect(ws.tagged).toBe(true);
					expect(ws.released).toBe(true);
				}

				// Fixed group references wired up
				expect(pkgA.fixed).toHaveLength(2);
				expect((pkgA.fixed as AnalyzedWorkspace[]).map((w) => w.name).sort()).toEqual(["@scope/pkg-b", "@scope/pkg-c"]);
				expect(pkgB.fixed).toHaveLength(2);
				expect(pkgC.fixed).toHaveLength(2);

				expect(result.versioning).toMatchObject({
					type: "fixed-group",
				});
				expect(result.tagStrategy).toBe("single");
			});

			it("independent: two publishable packages with no fixed group", async () => {
				const root = fixtureRoot("node/pnpm/silk/independent");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);

				// root + pkg-x + pkg-y = 3
				expect(result.workspaces).toHaveLength(3);

				const pkgX = Option.getOrThrow(result.findWorkspace("@scope/pkg-x"));
				const pkgY = Option.getOrThrow(result.findWorkspace("@scope/pkg-y"));

				expect(pkgX.publishable).toBe(true);
				expect(pkgY.publishable).toBe(true);
				expect(pkgX.fixed).toHaveLength(0);
				expect(pkgY.fixed).toHaveLength(0);

				expect(result.versioning).toMatchObject({
					type: "independent",
				});
				expect(result.tagStrategy).toBe("scoped");
			});

			it("multi-fixed: multiple fixed groups → independent versioning", async () => {
				const root = fixtureRoot("node/pnpm/silk/multi-fixed");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);

				// root + 4 packages = 5
				expect(result.workspaces).toHaveLength(5);

				const g1a = Option.getOrThrow(result.findWorkspace("@scope/group1-a"));
				const g1b = Option.getOrThrow(result.findWorkspace("@scope/group1-b"));
				const g2a = Option.getOrThrow(result.findWorkspace("@scope/group2-a"));
				const g2b = Option.getOrThrow(result.findWorkspace("@scope/group2-b"));

				// Fixed within groups
				expect(g1a.fixed).toHaveLength(1);
				expect((g1a.fixed[0] as AnalyzedWorkspace).name).toBe("@scope/group1-b");
				expect(g1b.fixed).toHaveLength(1);
				expect((g1b.fixed[0] as AnalyzedWorkspace).name).toBe("@scope/group1-a");

				expect(g2a.fixed).toHaveLength(1);
				expect((g2a.fixed[0] as AnalyzedWorkspace).name).toBe("@scope/group2-b");
				expect(g2b.fixed).toHaveLength(1);
				expect((g2b.fixed[0] as AnalyzedWorkspace).name).toBe("@scope/group2-a");

				// Multiple fixed groups means packages are NOT all in one group → independent
				expect(result.versioning).toMatchObject({
					type: "independent",
				});
				expect(result.tagStrategy).toBe("scoped");
			});

			it("linked: linked arrays populated between packages", async () => {
				const root = fixtureRoot("node/pnpm/silk/linked");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);

				// root + linked-a + linked-b = 3
				expect(result.workspaces).toHaveLength(3);

				const linkedA = Option.getOrThrow(result.findWorkspace("@scope/linked-a"));
				const linkedB = Option.getOrThrow(result.findWorkspace("@scope/linked-b"));

				expect(linkedA.linked).toHaveLength(1);
				expect((linkedA.linked[0] as AnalyzedWorkspace).name).toBe("@scope/linked-b");
				expect(linkedB.linked).toHaveLength(1);
				expect((linkedB.linked[0] as AnalyzedWorkspace).name).toBe("@scope/linked-a");

				// No fixed groups, so independent
				expect(result.versioning).toMatchObject({
					type: "independent",
				});
			});

			it("private-versioned-tagged: private packages versioned + tagged + released", async () => {
				const root = fixtureRoot("node/pnpm/silk/private-versioned-tagged");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);

				const privateApp = Option.getOrThrow(result.findWorkspace("@scope/private-app"));
				const publicLib = Option.getOrThrow(result.findWorkspace("@scope/public-lib"));

				// Private app: private=true, no publishConfig → not publishable
				// But privatePackages: { tag: true, version: true } → versioned + tagged
				expect(privateApp.publishable).toBe(false);
				expect(privateApp.versioned).toBe(true);
				expect(privateApp.tagged).toBe(true);
				expect(privateApp.released).toBe(true);

				// Public lib: private=true + publishConfig.access → publishable
				expect(publicLib.publishable).toBe(true);
				expect(publicLib.versioned).toBe(true);
				expect(publicLib.tagged).toBe(true);
				expect(publicLib.released).toBe(true);
			});

			it("private-versioned-only: private packages versioned but not tagged", async () => {
				const root = fixtureRoot("node/pnpm/silk/private-versioned-only");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);

				const privateApp = Option.getOrThrow(result.findWorkspace("@scope/pvo-app"));

				// privatePackages: { tag: false, version: true }
				expect(privateApp.publishable).toBe(false);
				expect(privateApp.versioned).toBe(true);
				expect(privateApp.tagged).toBe(false);
				expect(privateApp.released).toBe(false);
			});

			it("private-not-versioned: private packages completely ignored", async () => {
				const root = fixtureRoot("node/pnpm/silk/private-not-versioned");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);

				const privateApp = Option.getOrThrow(result.findWorkspace("@scope/pnv-app"));

				// privatePackages: false → completely ignored
				expect(privateApp.publishable).toBe(false);
				expect(privateApp.versioned).toBe(false);
				expect(privateApp.tagged).toBe(false);
				expect(privateApp.released).toBe(false);

				// Public lib is still publishable
				const publicLib = Option.getOrThrow(result.findWorkspace("@scope/pnv-lib"));
				expect(publicLib.publishable).toBe(true);
			});

			it("ignored: ignored package not versioned, tracked package is versioned", async () => {
				const root = fixtureRoot("node/pnpm/silk/ignored");
				const result = await analyze(root);

				expect(result.hasChangesets).toBe(true);

				const ignored = Option.getOrThrow(result.findWorkspace("@scope/ignored-pkg"));
				const tracked = Option.getOrThrow(result.findWorkspace("@scope/tracked"));

				// @scope/ignored-pkg is in ignore list → not versioned/tagged/released
				expect(ignored.publishable).toBe(true);
				expect(ignored.versioned).toBe(false);
				expect(ignored.tagged).toBe(false);
				expect(ignored.released).toBe(false);

				// @scope/tracked is NOT in ignore list and IS publishable
				// (private: true + publishConfig.access = Silk publishable convention)
				// Publishable packages are always versioned/tagged regardless of private flag
				expect(tracked.publishable).toBe(true);
				expect(tracked.versioned).toBe(true);
				expect(tracked.tagged).toBe(true);
				expect(tracked.released).toBe(true);
			});
		});
	});

	// -----------------------------------------------------------------------
	// node/npm
	// -----------------------------------------------------------------------
	describe("node/npm", () => {
		describe("default", () => {
			it("basic: discovers workspaces, packageManager.type='npm'", async () => {
				const root = fixtureRoot("node/npm/default/basic");
				// npm fixtures have "workspaces" field → real detector finds npm
				const result = await analyze(root, mockPM("npm"));

				expect(result.runtime).toBe("node");
				expect(result.packageManager.type).toBe("npm");
				expect(result.changesetConfig).toBeNull();

				// root + lib-a + lib-b = 3
				expect(result.workspaces).toHaveLength(3);

				const libA = Option.getOrThrow(result.findWorkspace("@scope/npm-lib-a"));
				expect(libA.publishable).toBe(true);

				const libB = Option.getOrThrow(result.findWorkspace("@scope/npm-lib-b"));
				expect(libB.publishable).toBe(false);
			});

			it("object-form: discovers from { packages: [...] } form", async () => {
				const root = fixtureRoot("node/npm/default/object-form");
				const result = await analyze(root, mockPM("npm"));

				expect(result.packageManager.type).toBe("npm");

				// root + lib-a = 2
				expect(result.workspaces).toHaveLength(2);

				const libA = Option.getOrThrow(result.findWorkspace("@scope/obj-lib-a"));
				expect(libA.publishable).toBe(true);
			});
		});

		describe("silk", () => {
			it("basic: has changeset config, isSilk=true", async () => {
				const root = fixtureRoot("node/npm/silk/basic");
				const result = await analyze(root, mockPM("npm"));

				expect(result.packageManager.type).toBe("npm");
				expect(result.hasChangesets).toBe(true);
				expect(result.isSilk).toBe(true);

				// root + lib-a = 2
				expect(result.workspaces).toHaveLength(2);

				const libA = Option.getOrThrow(result.findWorkspace("@scope/npm-silk-a"));
				expect(libA.publishable).toBe(true);
			});
		});
	});

	// -----------------------------------------------------------------------
	// node/yarn
	// -----------------------------------------------------------------------
	describe("node/yarn", () => {
		it("basic: packageManager.type='yarn', runtime='node'", async () => {
			const root = fixtureRoot("node/yarn/default/basic");
			// No yarn.lock → real detector falls back to npm; use mockPM
			const result = await analyze(root, mockPM("yarn"));

			expect(result.runtime).toBe("node");
			expect(result.packageManager.type).toBe("yarn");
			expect(result.changesetConfig).toBeNull();

			// root + lib-a = 2
			expect(result.workspaces).toHaveLength(2);

			const libA = Option.getOrThrow(result.findWorkspace("@scope/yarn-lib-a"));
			expect(libA.publishable).toBe(true);
		});

		it("silk: has changeset config, isSilk=true", async () => {
			const root = fixtureRoot("node/yarn/silk/basic");
			const result = await analyze(root, mockPM("yarn"));

			expect(result.packageManager.type).toBe("yarn");
			expect(result.hasChangesets).toBe(true);
			expect(result.isSilk).toBe(true);

			// root + lib-a = 2
			expect(result.workspaces).toHaveLength(2);

			const libA = Option.getOrThrow(result.findWorkspace("@scope/yarn-silk-a"));
			expect(libA.publishable).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// bun
	// -----------------------------------------------------------------------
	describe("bun", () => {
		it("basic: packageManager.type='bun', runtime='bun'", async () => {
			const root = fixtureRoot("bun/default/basic");
			// No bun.lock → real detector falls back to npm; use mockPM
			const result = await analyze(root, mockPM("bun", "bun"));

			expect(result.runtime).toBe("bun");
			expect(result.packageManager.type).toBe("bun");
			expect(result.changesetConfig).toBeNull();

			// root + lib-a = 2
			expect(result.workspaces).toHaveLength(2);

			const libA = Option.getOrThrow(result.findWorkspace("@scope/bun-lib-a"));
			expect(libA.publishable).toBe(true);
		});

		it("silk: has changeset config, isSilk=true", async () => {
			const root = fixtureRoot("bun/silk/basic");
			const result = await analyze(root, mockPM("bun", "bun"));

			expect(result.packageManager.type).toBe("bun");
			expect(result.runtime).toBe("bun");
			expect(result.hasChangesets).toBe(true);
			expect(result.isSilk).toBe(true);

			// root + lib-a = 2
			expect(result.workspaces).toHaveLength(2);

			const libA = Option.getOrThrow(result.findWorkspace("@scope/bun-silk-a"));
			expect(libA.publishable).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Cross-cutting assertions
	// -----------------------------------------------------------------------
	describe("cross-cutting", () => {
		it("publishableWorkspaces filters correctly", async () => {
			const root = fixtureRoot("node/pnpm/default/basic");
			const result = await analyze(root);

			// lib-npm, lib-multi, lib-triple, lib-objects, lib-custom, lib-link, app = 7 publishable
			// root, internal, lib-minimal are NOT publishable
			expect(result.publishableWorkspaces).toHaveLength(7);
			expect(result.publishableWorkspaces.every((w) => w.publishable)).toBe(true);
		});

		it("findWorkspace returns None for unknown name", async () => {
			const root = fixtureRoot("standalone/default/private");
			const result = await analyze(root, mockPM("npm"));

			expect(Option.isNone(result.findWorkspace("nonexistent"))).toBe(true);
		});

		it("AnalyzedWorkspace helper methods work", async () => {
			const root = fixtureRoot("node/pnpm/default/basic");
			const result = await analyze(root);

			const libMulti = Option.getOrThrow(result.findWorkspace("@scope/lib-multi"));
			expect(libMulti.hasTarget("npm")).toBe(true);
			expect(libMulti.hasTarget("github")).toBe(true);
			expect(libMulti.hasTarget("jsr")).toBe(false);

			const libTriple = Option.getOrThrow(result.findWorkspace("@scope/lib-triple"));
			expect(libTriple.hasTarget("jsr")).toBe(true);

			expect(libMulti.isPublishable).toBe(true);
			expect(libMulti.isRoot).toBe(false);
		});
	});
});

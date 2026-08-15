import { resolve } from "node:path";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
	DetectedPackageManager,
	PackageManagerDetector,
	WorkspaceDiscovery,
	WorkspaceRoot,
} from "@effected/workspaces";
import { Effect, Layer, Logger, Option } from "effect";
import type { AnalyzedWorkspace } from "../../src/schemas/WorkspaceAnalysisSchemas.js";
import { ChangesetConfigReader } from "../../src/services/ChangesetConfigReader.js";
import { SilkWorkspaceAnalyzer } from "../../src/services/SilkWorkspaceAnalyzer.js";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const FIXTURES = resolve(import.meta.dirname, "fixtures/workspaces");
const fixtureRoot = (...segments: string[]) => resolve(FIXTURES, ...segments);

const platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, Logger.layer([]));

/**
 * Create a mock PackageManagerDetector for fixtures that lack lockfiles.
 * Without a lockfile the real detector either falls back to "npm" (when a
 * `workspaces` field exists) or fails entirely (standalone packages).
 *
 * `evidence` names the detection rung that would have decided each manager in
 * a real workspace — the kit's closed vocabulary, one canonical rung per name.
 */
const MOCK_EVIDENCE = {
	bun: "bun.lock",
	npm: "package.json#workspaces",
	pnpm: "pnpm-workspace.yaml",
	yarn: "yarn.lock",
} as const;

const mockPM = (type: "npm" | "pnpm" | "yarn" | "bun" = "npm", runtime: "node" | "bun" = "node") =>
	Layer.succeed(PackageManagerDetector, {
		detect: () =>
			Effect.succeed(
				DetectedPackageManager.make({ name: type, version: Option.none(), runtime, evidence: MOCK_EVIDENCE[type] }),
			),
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

	// The kit discovery is root-bound at layer build: cwd resolves through the
	// mocked WorkspaceRoot, so each fixture gets its own discovery layer.
	const discovery = WorkspaceDiscovery.layer({ cwd: fixturePath }).pipe(Layer.provide(Layer.merge(mockRoot, platform)));

	const pm = pmLayer ?? PackageManagerDetector.layer.pipe(Layer.provide(platform));

	const changesetReader = ChangesetConfigReader.layer.pipe(Layer.provide(platform));

	// Topological ordering is a pure DependencyGraph value inside the analyzer
	// in v4, and versioning/tag classification are pure `@effected/workspaces`
	// value operations — no sorter, versioning or tag layers to wire.
	return SilkWorkspaceAnalyzer.layer.pipe(Layer.provide(Layer.mergeAll(platform, discovery, pm, changesetReader)));
};

/**
 * Run the analyzer against a fixture and return the WorkspaceAnalysis.
 */
// Per-test provide is REQUIRED: `makeTestLayer` is built from the per-test `fixturePath`
// (and an optional per-test package-manager stub), so the layer genuinely varies test by
// test and cannot be hoisted into a suite-boundary `layer(...)` block.
const analyze = (fixturePath: string, pmLayer?: Layer.Layer<PackageManagerDetector>) =>
	SilkWorkspaceAnalyzer.pipe(
		Effect.andThen((analyzer) => analyzer.analyze(fixturePath)),
		Effect.provide(makeTestLayer(fixturePath, pmLayer)),
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
			it.effect("private: single workspace, not publishable", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("standalone/default/private");
					const result = yield* analyze(root, mockPM("npm"));

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
				}),
			);

			it.effect("not-publishable: public package without publishConfig is publishable by canonical silk rule", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("standalone/default/not-publishable");
					const result = yield* analyze(root, mockPM("npm"));

					expect(result.workspaces).toHaveLength(1);

					const ws = Option.getOrThrow(result.rootWorkspace);
					expect(ws.name).toBe("not-publishable-pkg");
					// Non-private, no publishConfig → canonical silk rule: default npm target
					expect(ws.publishable).toBe(true);
					expect(ws.targets).toHaveLength(1);
					expect(ws.targets[0].registry).toBe("https://registry.npmjs.org/");
					expect(ws.targets[0].access).toBe("public");
				}),
			);

			it.effect("npm-target: publishable with default npm target", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("standalone/default/npm-target");
					const result = yield* analyze(root, mockPM("npm"));

					expect(result.workspaces).toHaveLength(1);

					const ws = Option.getOrThrow(result.rootWorkspace);
					expect(ws.name).toBe("npm-target-pkg");
					expect(ws.publishable).toBe(true);
					expect(ws.targets).toHaveLength(1);
					expect(ws.targets[0].registry).toBe("https://registry.npmjs.org/");
				}),
			);

			it.effect("multi-target: publishable with two object targets", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("standalone/default/multi-target");
					const result = yield* analyze(root, mockPM("npm"));

					expect(result.workspaces).toHaveLength(1);

					const ws = Option.getOrThrow(result.rootWorkspace);
					expect(ws.name).toBe("multi-target-pkg");
					expect(ws.publishable).toBe(true);
					expect(ws.targets).toHaveLength(2);

					const registries = ws.targets.map((t) => t.registry);
					expect(registries).toContain("https://npm.pkg.github.com/");
					expect(registries).toContain("https://registry.npmjs.org/");
				}),
			);

			it.effect("custom-registry: publishable with custom registry URL", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("standalone/default/custom-registry");
					const result = yield* analyze(root, mockPM("npm"));

					expect(result.workspaces).toHaveLength(1);

					const ws = Option.getOrThrow(result.rootWorkspace);
					expect(ws.name).toBe("custom-registry-pkg");
					expect(ws.publishable).toBe(true);
					expect(ws.targets).toHaveLength(1);
					expect(ws.targets[0].registry).toBe("https://custom.registry.com/");
				}),
			);
		});

		describe("silk", () => {
			it.effect("single: publishable with changeset config, fully released", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("standalone/silk/single");
					const result = yield* analyze(root, mockPM("npm"));

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
				}),
			);
		});
	});

	// -----------------------------------------------------------------------
	// node/pnpm
	// -----------------------------------------------------------------------
	describe("node/pnpm", () => {
		describe("default", () => {
			it.effect("basic: discovers root + 9 packages with various publishConfig", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/default/basic");
					const result = yield* analyze(root);

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

					// @scope/lib-minimal: no private, no publishConfig → canonical silk rule: default npm target
					const libMinimal = Option.getOrThrow(result.findWorkspace("@scope/lib-minimal"));
					expect(libMinimal.publishable).toBe(true);

					// @scope/lib-link: private + access + linkDirectory → publishable
					const libLink = Option.getOrThrow(result.findWorkspace("@scope/lib-link"));
					expect(libLink.publishable).toBe(true);
				}),
			);

			it.effect("root-as-package: root is the only workspace (no duplication)", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/default/root-as-package");
					const result = yield* analyze(root);

					// pnpm-workspace.yaml has "." — root listed once
					expect(result.workspaces).toHaveLength(1);

					const ws = Option.getOrThrow(result.rootWorkspace);
					expect(ws.name).toBe("root-only-pkg");
					expect(ws.root).toBe(true);
					expect(ws.publishable).toBe(true);
				}),
			);

			it.effect("multi-root: discovers from packages/* and apps/*", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/default/multi-root");
					const result = yield* analyze(root);

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
				}),
			);

			it.effect("explicit-paths: discovers only named paths", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/default/explicit-paths");
					const result = yield* analyze(root);

					// root + foo + bar = 3
					expect(result.workspaces).toHaveLength(3);

					expect(Option.isSome(result.findWorkspace("@scope/foo"))).toBe(true);
					expect(Option.isSome(result.findWorkspace("@scope/bar"))).toBe(true);
				}),
			);
		});

		describe("silk", () => {
			it.effect("single: versioning.type='single', single publishable package", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/single");
					const result = yield* analyze(root);

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
				}),
			);

			it.effect("fixed-group: all publishable packages in one fixed group", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/fixed-group");
					const result = yield* analyze(root);

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
					expect((pkgA.fixed as AnalyzedWorkspace[]).map((w) => w.name).sort()).toEqual([
						"@scope/pkg-b",
						"@scope/pkg-c",
					]);
					expect(pkgB.fixed).toHaveLength(2);
					expect(pkgC.fixed).toHaveLength(2);

					expect(result.versioning).toMatchObject({
						type: "fixed-group",
					});
					expect(result.tagStrategy).toBe("single");
				}),
			);

			it.effect("independent: two publishable packages with no fixed group", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/independent");
					const result = yield* analyze(root);

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
				}),
			);

			it.effect("multi-fixed: multiple fixed groups → independent versioning", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/multi-fixed");
					const result = yield* analyze(root);

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
				}),
			);

			it.effect("linked: linked arrays populated between packages", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/linked");
					const result = yield* analyze(root);

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
				}),
			);

			it.effect("private-versioned-tagged: private packages versioned + tagged + released", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/private-versioned-tagged");
					const result = yield* analyze(root);

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
				}),
			);

			it.effect("private-versioned-only: private packages versioned but not tagged", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/private-versioned-only");
					const result = yield* analyze(root);

					expect(result.hasChangesets).toBe(true);

					const privateApp = Option.getOrThrow(result.findWorkspace("@scope/pvo-app"));

					// privatePackages: { tag: false, version: true }
					expect(privateApp.publishable).toBe(false);
					expect(privateApp.versioned).toBe(true);
					expect(privateApp.tagged).toBe(false);
					expect(privateApp.released).toBe(false);
				}),
			);

			it.effect("private-not-versioned: private packages completely ignored", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/private-not-versioned");
					const result = yield* analyze(root);

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
				}),
			);

			it.effect("ignored: ignored package not versioned, tracked package is versioned", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/pnpm/silk/ignored");
					const result = yield* analyze(root);

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
				}),
			);
		});
	});

	// -----------------------------------------------------------------------
	// node/npm
	// -----------------------------------------------------------------------
	describe("node/npm", () => {
		describe("default", () => {
			it.effect("basic: discovers workspaces, packageManager.type='npm'", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/npm/default/basic");
					// npm fixtures have "workspaces" field → real detector finds npm
					const result = yield* analyze(root, mockPM("npm"));

					expect(result.runtime).toBe("node");
					expect(result.packageManager.type).toBe("npm");
					expect(result.changesetConfig).toBeNull();

					// root + lib-a + lib-b = 3
					expect(result.workspaces).toHaveLength(3);

					const libA = Option.getOrThrow(result.findWorkspace("@scope/npm-lib-a"));
					expect(libA.publishable).toBe(true);

					const libB = Option.getOrThrow(result.findWorkspace("@scope/npm-lib-b"));
					expect(libB.publishable).toBe(false);
				}),
			);

			it.effect("object-form: discovers from { packages: [...] } form", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/npm/default/object-form");
					const result = yield* analyze(root, mockPM("npm"));

					expect(result.packageManager.type).toBe("npm");

					// root + lib-a = 2
					expect(result.workspaces).toHaveLength(2);

					const libA = Option.getOrThrow(result.findWorkspace("@scope/obj-lib-a"));
					expect(libA.publishable).toBe(true);
				}),
			);
		});

		describe("silk", () => {
			it.effect("basic: has changeset config, isSilk=true", () =>
				Effect.gen(function* () {
					const root = fixtureRoot("node/npm/silk/basic");
					const result = yield* analyze(root, mockPM("npm"));

					expect(result.packageManager.type).toBe("npm");
					expect(result.hasChangesets).toBe(true);
					expect(result.isSilk).toBe(true);

					// root + lib-a = 2
					expect(result.workspaces).toHaveLength(2);

					const libA = Option.getOrThrow(result.findWorkspace("@scope/npm-silk-a"));
					expect(libA.publishable).toBe(true);
				}),
			);
		});
	});

	// -----------------------------------------------------------------------
	// node/yarn
	// -----------------------------------------------------------------------
	describe("node/yarn", () => {
		it.effect("basic: packageManager.type='yarn', runtime='node'", () =>
			Effect.gen(function* () {
				const root = fixtureRoot("node/yarn/default/basic");
				// No yarn.lock → real detector falls back to npm; use mockPM
				const result = yield* analyze(root, mockPM("yarn"));

				expect(result.runtime).toBe("node");
				expect(result.packageManager.type).toBe("yarn");
				expect(result.changesetConfig).toBeNull();

				// root + lib-a = 2
				expect(result.workspaces).toHaveLength(2);

				const libA = Option.getOrThrow(result.findWorkspace("@scope/yarn-lib-a"));
				expect(libA.publishable).toBe(true);
			}),
		);

		it.effect("silk: has changeset config, isSilk=true", () =>
			Effect.gen(function* () {
				const root = fixtureRoot("node/yarn/silk/basic");
				const result = yield* analyze(root, mockPM("yarn"));

				expect(result.packageManager.type).toBe("yarn");
				expect(result.hasChangesets).toBe(true);
				expect(result.isSilk).toBe(true);

				// root + lib-a = 2
				expect(result.workspaces).toHaveLength(2);

				const libA = Option.getOrThrow(result.findWorkspace("@scope/yarn-silk-a"));
				expect(libA.publishable).toBe(true);
			}),
		);
	});

	// -----------------------------------------------------------------------
	// bun
	// -----------------------------------------------------------------------
	describe("bun", () => {
		it.effect("basic: packageManager.type='bun', runtime='bun'", () =>
			Effect.gen(function* () {
				const root = fixtureRoot("bun/default/basic");
				// No bun.lock → real detector falls back to npm; use mockPM
				const result = yield* analyze(root, mockPM("bun", "bun"));

				expect(result.runtime).toBe("bun");
				expect(result.packageManager.type).toBe("bun");
				expect(result.changesetConfig).toBeNull();

				// root + lib-a = 2
				expect(result.workspaces).toHaveLength(2);

				const libA = Option.getOrThrow(result.findWorkspace("@scope/bun-lib-a"));
				expect(libA.publishable).toBe(true);
			}),
		);

		it.effect("silk: has changeset config, isSilk=true", () =>
			Effect.gen(function* () {
				const root = fixtureRoot("bun/silk/basic");
				const result = yield* analyze(root, mockPM("bun", "bun"));

				expect(result.packageManager.type).toBe("bun");
				expect(result.runtime).toBe("bun");
				expect(result.hasChangesets).toBe(true);
				expect(result.isSilk).toBe(true);

				// root + lib-a = 2
				expect(result.workspaces).toHaveLength(2);

				const libA = Option.getOrThrow(result.findWorkspace("@scope/bun-silk-a"));
				expect(libA.publishable).toBe(true);
			}),
		);
	});

	// -----------------------------------------------------------------------
	// Cross-cutting assertions
	// -----------------------------------------------------------------------
	describe("cross-cutting", () => {
		it.effect("publishableWorkspaces filters correctly", () =>
			Effect.gen(function* () {
				const root = fixtureRoot("node/pnpm/default/basic");
				const result = yield* analyze(root);

				// lib-npm, lib-multi, lib-triple, lib-objects, lib-custom, lib-link, app, lib-minimal = 8 publishable
				// lib-minimal is non-private with no publishConfig → canonical silk rule: default npm target
				// root (private, no publishConfig) and internal (private, no publishConfig) are NOT publishable
				expect(result.publishableWorkspaces).toHaveLength(8);
				expect(result.publishableWorkspaces.every((w) => w.publishable)).toBe(true);
			}),
		);

		it.effect("findWorkspace returns None for unknown name", () =>
			Effect.gen(function* () {
				const root = fixtureRoot("standalone/default/private");
				const result = yield* analyze(root, mockPM("npm"));

				expect(Option.isNone(result.findWorkspace("nonexistent"))).toBe(true);
			}),
		);

		it.effect("AnalyzedWorkspace helper methods work", () =>
			Effect.gen(function* () {
				const root = fixtureRoot("node/pnpm/default/basic");
				const result = yield* analyze(root);

				const libMulti = Option.getOrThrow(result.findWorkspace("@scope/lib-multi"));
				expect(libMulti.hasTarget("npm")).toBe(true);
				expect(libMulti.hasTarget("github")).toBe(true);
				expect(libMulti.hasTarget("jsr")).toBe(false);

				const libTriple = Option.getOrThrow(result.findWorkspace("@scope/lib-triple"));
				expect(libTriple.hasTarget("jsr")).toBe(true);

				expect(libMulti.isPublishable).toBe(true);
				expect(libMulti.isRoot).toBe(false);
			}),
		);
	});
});

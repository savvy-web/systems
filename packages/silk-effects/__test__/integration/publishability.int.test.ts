/**
 * Publishability fixture harness.
 *
 * Runs the composed publish-target resolution path
 * (`SilkPublishabilityDetectorLive` + the private-build filter in
 * `resolveTargets`) against the hand-authored fixture-workspaces
 * under `fixtures/publishability/`, asserting each fixture's resolved
 * `{ publishTargets, versionable }` disposition.
 *
 * The fixtures cover every `silkDetect` permutation and the
 * `privatePackages.version` interaction. `private-target-with-directory`
 * guards the `42cc7e2` regression (per-target `directory` discarded, target
 * resolved to the private dev build and dropped); `private-shorthand-targets`
 * guards shorthand-string expansion; `public-multi-target` mirrors the
 * `@savvy-web/lint-staged` shape (public source + `publishConfig.targets`) and
 * guards the regression where a non-private source short-circuited to a single
 * default target at `publishConfig.directory` (the private `dist/dev` artifact),
 * which the private-build filter then dropped — misclassifying the package as
 * version-only.
 */

import { fileURLToPath } from "node:url";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspacePackage } from "workspaces-effect";
import { ChangesetConfig, ChangesetConfigLive } from "../../src/services/ChangesetConfig.js";
import { ChangesetConfigReaderLive } from "../../src/services/ChangesetConfigReader.js";
import {
	PublishabilityDetectorAdaptiveLive,
	SilkPublishability,
	SilkPublishabilityDetectorLive,
} from "../../src/services/SilkPublishability.js";

const platform = NodeFileSystem.layer;

/**
 * Resolve `{ publishTargets, versionable }` for a fixture-workspace directory.
 *
 * Builds a minimal `WorkspacePackage` whose `path` is the fixture directory
 * (the silk detector reads `package.json` from disk), runs the composed
 * `SilkPublishability.resolveTargets`, and derives `versionable` from the targets and
 * the fixture's `.changeset/config.json` `privatePackages.version`.
 */
const resolveFixture = (name: string) =>
	Effect.gen(function* () {
		const dir = fileURLToPath(new URL(`fixtures/publishability/${name}`, import.meta.url));
		const pkg = new WorkspacePackage({
			name: `@fixture/${name}`,
			version: "1.0.0",
			path: dir,
			packageJsonPath: fileURLToPath(new URL(`fixtures/publishability/${name}/package.json`, import.meta.url)),
			relativePath: ".",
		});
		const config = yield* ChangesetConfig;
		const publishTargets = yield* SilkPublishability.resolveTargets(pkg, dir);
		const versionPrivate = yield* config.versionPrivate(dir);
		return { publishTargets, versionable: publishTargets.length > 0 || versionPrivate };
	}).pipe(
		Effect.provide(
			Layer.mergeAll(
				platform,
				SilkPublishabilityDetectorLive.pipe(Layer.provide(platform)),
				ChangesetConfigLive.pipe(Layer.provide(ChangesetConfigReaderLive.pipe(Layer.provide(platform)))),
			),
		),
	);

describe("publishability fixture harness", () => {
	it("should resolve one public target from the package root when the package is not private (public-package fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("public-package"));
		expect(publishTargets).toHaveLength(1);
		expect(publishTargets[0].registry).toBe("https://registry.npmjs.org/");
		expect(publishTargets[0].directory).toBe(".");
		expect(publishTargets[0].access).toBe("public");
		expect(publishTargets[0].provenance).toBe(false);
		expect(versionable).toBe(true);
	});

	it("should resolve no targets and be non-versionable when the package is private with no publishConfig (private-fully-private fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-fully-private"));
		expect(publishTargets).toHaveLength(0);
		expect(versionable).toBe(false);
	});

	it("should resolve no targets but stay versionable when privatePackages.version is enabled (private-versiononly fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-versiononly"));
		expect(publishTargets).toHaveLength(0);
		expect(versionable).toBe(true);
	});

	it("should resolve one public target at dist/npm when a private package declares publishConfig.access public (private-access-public fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-access-public"));
		expect(publishTargets).toHaveLength(1);
		expect(publishTargets[0].registry).toBe("https://registry.npmjs.org/");
		expect(publishTargets[0].directory).toBe("dist/npm");
		expect(publishTargets[0].access).toBe("public");
		expect(publishTargets[0].provenance).toBe(false);
		expect(versionable).toBe(true);
	});

	it("should resolve one restricted target at dist/npm when a private package declares publishConfig.access restricted (private-access-restricted fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-access-restricted"));
		expect(publishTargets).toHaveLength(1);
		expect(publishTargets[0].registry).toBe("https://registry.npmjs.org/");
		expect(publishTargets[0].directory).toBe("dist/npm");
		expect(publishTargets[0].access).toBe("restricted");
		expect(versionable).toBe(true);
	});

	it("should drop the detected target and stay versionable via privatePackages.version when publishConfig.access has no directory (private-access-no-build fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-access-no-build"));
		expect(publishTargets).toHaveLength(0);
		expect(versionable).toBe(true);
	});

	it("should resolve one target to the per-target dist/npm directory with provenance when a private package declares a target directory (private-target-with-directory fixture, 42cc7e2 regression guard)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-target-with-directory"));
		expect(publishTargets).toHaveLength(1);
		expect(publishTargets[0].directory).toBe("dist/npm");
		expect(publishTargets[0].registry).toBe("https://npm.pkg.github.com/");
		expect(publishTargets[0].access).toBe("public");
		expect(publishTargets[0].provenance).toBe(true);
		expect(versionable).toBe(true);
	});

	it("should resolve two targets for npm and GitHub Packages when a private package declares multiple object targets (private-multi-target fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-multi-target"));
		expect(publishTargets).toHaveLength(2);
		const registries = publishTargets.map((t) => t.registry).sort();
		expect(registries).toEqual(["https://npm.pkg.github.com/", "https://registry.npmjs.org/"]);
		for (const target of publishTargets) {
			expect(target.directory).toBe("dist/npm");
			expect(target.access).toBe("public");
		}
		expect(versionable).toBe(true);
	});

	it("should expand shorthand string targets to their canonical registries when a private package uses target shorthands (private-shorthand-targets fixture, shorthand-expansion guard)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-shorthand-targets"));
		expect(publishTargets).toHaveLength(2);
		const registries = publishTargets.map((t) => t.registry).sort();
		expect(registries).toEqual(["https://npm.pkg.github.com/", "https://registry.npmjs.org/"]);
		for (const target of publishTargets) {
			expect(target.directory).toBe("dist/npm");
			expect(target.access).toBe("public");
		}
		expect(versionable).toBe(true);
	});

	it("should skip the access-less target and default the surviving target's registry when a private package mixes target access (private-mixed-access fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-mixed-access"));
		expect(publishTargets).toHaveLength(1);
		expect(publishTargets[0].registry).toBe("https://registry.npmjs.org/");
		expect(publishTargets[0].directory).toBe("dist/npm");
		expect(publishTargets[0].access).toBe("public");
		expect(versionable).toBe(true);
	});

	it("should resolve both targets at dist/npm when a non-private source declares publishConfig.targets (public-multi-target fixture, lint-staged version-only regression guard)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("public-multi-target"));
		expect(publishTargets).toHaveLength(2);
		// Declaration order is preserved (GitHub Packages first, then npm) — these
		// must resolve to the public dist/npm artifact, NOT the private dist/dev
		// build named by publishConfig.directory.
		expect(publishTargets.map((t) => t.registry)).toEqual([
			"https://npm.pkg.github.com/",
			"https://registry.npmjs.org/",
		]);
		for (const target of publishTargets) {
			expect(target.directory).toBe("dist/npm");
			expect(target.access).toBe("public");
			expect(target.provenance).toBe(true);
		}
		expect(versionable).toBe(true);
	});

	it("should drop the detected target and be non-versionable when the built target package.json is private (private-target-built-private fixture)", async () => {
		const { publishTargets, versionable } = await Effect.runPromise(resolveFixture("private-target-built-private"));
		expect(publishTargets).toHaveLength(0);
		expect(versionable).toBe(false);
	});
});

/** Resolve one sub-package of a workspace fixture against the fixture root. */
const resolveWorkspacePackage = (workspace: string, subPath: string, name: string) =>
	Effect.gen(function* () {
		const root = fileURLToPath(new URL(`fixtures/publishability/${workspace}`, import.meta.url));
		const dir = fileURLToPath(new URL(`fixtures/publishability/${workspace}/${subPath}`, import.meta.url));
		const pkg = new WorkspacePackage({
			name,
			version: "1.0.0",
			path: dir,
			packageJsonPath: fileURLToPath(
				new URL(`fixtures/publishability/${workspace}/${subPath}/package.json`, import.meta.url),
			),
			relativePath: subPath,
		});
		return yield* SilkPublishability.resolveTargets(pkg, root);
	}).pipe(
		Effect.provide(
			Layer.mergeAll(
				platform,
				PublishabilityDetectorAdaptiveLive.pipe(
					Layer.provide(
						Layer.mergeAll(
							platform,
							ChangesetConfigLive.pipe(Layer.provide(ChangesetConfigReaderLive.pipe(Layer.provide(platform)))),
						),
					),
				),
				ChangesetConfigLive.pipe(Layer.provide(ChangesetConfigReaderLive.pipe(Layer.provide(platform)))),
			),
		),
	);

describe("changeset ignore (ignore-monorepo fixture)", () => {
	it("resolves the main package to exactly one targetGroup / one target", async () => {
		const targets = await Effect.runPromise(
			resolveWorkspacePackage("ignore-monorepo", "package", "@fixture/ignore-main"),
		);
		expect(targets).toHaveLength(1);
		expect(targets[0].directory).toBe("dist/npm");
		expect(targets[0].registry).toBe("https://registry.npmjs.org/");
	});

	it("excludes a @libraries/* example package despite its publishConfig.targets", async () => {
		const targets = await Effect.runPromise(
			resolveWorkspacePackage("ignore-monorepo", "examples/lib", "@libraries/example"),
		);
		expect(targets).toHaveLength(0);
	});

	it("excludes a @rspress/* example package despite its publishConfig.targets", async () => {
		const targets = await Effect.runPromise(
			resolveWorkspacePackage("ignore-monorepo", "examples/site", "@rspress/example"),
		);
		expect(targets).toHaveLength(0);
	});
});

/**
 * Publishability fixture harness.
 *
 * Runs the composed publish-target resolution path
 * (`SilkPublishability.layer` + the private-build filter in
 * `resolveTargets`) against the hand-authored fixture-workspaces
 * under `fixtures/publishability/`, asserting each fixture's resolved
 * `{ publishTargets, versionable }` disposition.
 *
 * The fixtures cover every `silkDetect` permutation and the
 * `privatePackages.version` interaction, all expressed in the bundler's
 * Record-map `publishConfig.targets` form (the legacy array form is removed).
 * Each multi-target fixture ships a realistic `dist/prod/targets.json` binding,
 * so resolved targets carry the binding's `name`/`registry` and their group's
 * `dist/prod/<group>/pkg` directory.
 *
 * `private-target-with-directory` covers a single well-known `github: true`
 * target; `private-multi-target`/`public-multi-target` cover the `npm: true` +
 * `github: true` dual-registry collapse (one scoped-name group, two registry
 * targets); `private-shorthand-targets` covers the `npm: true` + `github: true`
 * pair resolving to canonical registries from the binding; `private-mixed-access`
 * covers a `from`-reuse target (a custom key reusing `npm`'s group bytes under a
 * custom registry); `private-target-built-private` covers the private-build
 * filter dropping a target whose bound group's `package.json` is `private: true`.
 */

import { fileURLToPath } from "node:url";
import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { WorkspacePackage } from "@effected/workspaces";
import { Effect, Layer } from "effect";
import { ChangesetConfig } from "../../src/services/ChangesetConfig.js";
import { ChangesetConfigReader } from "../../src/services/ChangesetConfigReader.js";
import { SilkPublishability } from "../../src/services/SilkPublishability.js";

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
			workspaceRoot: dir,
		});
		const config = yield* ChangesetConfig;
		const publishTargets = yield* SilkPublishability.resolveTargets(pkg, dir);
		const versionPrivate = yield* config.versionPrivate(dir);
		return { publishTargets, versionable: publishTargets.length > 0 || versionPrivate };
	}).pipe(
		Effect.provide(
			Layer.mergeAll(
				platform,
				SilkPublishability.layer.pipe(Layer.provide(platform)),
				ChangesetConfig.layer.pipe(Layer.provide(ChangesetConfigReader.layer.pipe(Layer.provide(platform)))),
			),
		),
	);

describe("publishability fixture harness", () => {
	it.effect(
		"should resolve one public target from the package root when the package is not private (public-package fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("public-package");
				expect(publishTargets).toHaveLength(1);
				expect(publishTargets[0].registry).toBe("https://registry.npmjs.org/");
				expect(publishTargets[0].directory).toBe(".");
				expect(publishTargets[0].access).toBe("public");
				expect(publishTargets[0].provenance).toBe(true);
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should resolve no targets and be non-versionable when the package is private with no publishConfig (private-fully-private fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-fully-private");
				expect(publishTargets).toHaveLength(0);
				expect(versionable).toBe(false);
			}),
	);

	it.effect(
		"should resolve no targets but stay versionable when privatePackages.version is enabled (private-versiononly fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-versiononly");
				expect(publishTargets).toHaveLength(0);
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should resolve one public target at dist/npm when a private package declares publishConfig.access public (private-access-public fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-access-public");
				expect(publishTargets).toHaveLength(1);
				expect(publishTargets[0].registry).toBe("https://registry.npmjs.org/");
				expect(publishTargets[0].directory).toBe("dist/npm");
				expect(publishTargets[0].access).toBe("public");
				expect(publishTargets[0].provenance).toBe(true);
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should resolve one restricted target at dist/npm when a private package declares publishConfig.access restricted (private-access-restricted fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-access-restricted");
				expect(publishTargets).toHaveLength(1);
				expect(publishTargets[0].registry).toBe("https://registry.npmjs.org/");
				expect(publishTargets[0].directory).toBe("dist/npm");
				expect(publishTargets[0].access).toBe("restricted");
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should drop the detected target and stay versionable via privatePackages.version when publishConfig.access has no directory (private-access-no-build fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-access-no-build");
				expect(publishTargets).toHaveLength(0);
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should resolve one github target at its group's dist/prod dir when a private package declares github: true (private-target-with-directory fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-target-with-directory");
				expect(publishTargets).toHaveLength(1);
				expect(publishTargets[0].directory).toBe("dist/prod/github/pkg");
				expect(publishTargets[0].registry).toBe("https://npm.pkg.github.com");
				expect(publishTargets[0].access).toBe("public");
				expect(publishTargets[0].provenance).toBe(true);
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should collapse npm: true + github: true into one group deployed to two registries when a private package declares both well-known targets (private-multi-target fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-multi-target");
				expect(publishTargets).toHaveLength(2);
				const registries = publishTargets.map((t) => t.registry).sort();
				expect(registries).toEqual(["https://npm.pkg.github.com", "https://registry.npmjs.org"]);
				// Both registry targets deploy the same scoped-name group's bytes.
				for (const target of publishTargets) {
					expect(target.directory).toBe("dist/prod/npm/pkg");
					expect(target.access).toBe("public");
					expect(target.provenance).toBe(true);
				}
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should resolve the well-known npm and github keys to their canonical registries from the binding (private-shorthand-targets fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-shorthand-targets");
				expect(publishTargets).toHaveLength(2);
				const registries = publishTargets.map((t) => t.registry).sort();
				expect(registries).toEqual(["https://npm.pkg.github.com", "https://registry.npmjs.org"]);
				for (const target of publishTargets) {
					expect(target.directory).toBe("dist/prod/npm/pkg");
					expect(target.access).toBe("public");
				}
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should reuse the npm group's bytes for a from-target pointed at a custom registry (private-mixed-access fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-mixed-access");
				expect(publishTargets).toHaveLength(2);
				const registries = publishTargets.map((t) => t.registry).sort();
				expect(registries).toEqual(["https://mirror.example.com", "https://registry.npmjs.org"]);
				// The `from: "npm"` mirror target deploys the same group bytes as npm.
				for (const target of publishTargets) {
					expect(target.directory).toBe("dist/prod/npm/pkg");
					expect(target.access).toBe("public");
				}
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should resolve both registry targets at the collapsed group's dist/prod dir when a non-private source declares npm + github (public-multi-target fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("public-multi-target");
				expect(publishTargets).toHaveLength(2);
				// The binding's target order is preserved (npm, then github); both deploy the
				// single collapsed scoped-name group's bytes.
				expect(publishTargets.map((t) => t.registry)).toEqual([
					"https://registry.npmjs.org",
					"https://npm.pkg.github.com",
				]);
				for (const target of publishTargets) {
					expect(target.directory).toBe("dist/prod/npm/pkg");
					expect(target.access).toBe("public");
					expect(target.provenance).toBe(true);
				}
				expect(versionable).toBe(true);
			}),
	);

	it.effect(
		"should drop the detected target and be non-versionable when the built target package.json is private (private-target-built-private fixture)",
		() =>
			Effect.gen(function* () {
				const { publishTargets, versionable } = yield* resolveFixture("private-target-built-private");
				expect(publishTargets).toHaveLength(0);
				expect(versionable).toBe(false);
			}),
	);
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
			workspaceRoot: root,
		});
		return yield* SilkPublishability.resolveTargets(pkg, root);
	}).pipe(
		Effect.provide(
			Layer.mergeAll(
				platform,
				// The kit detect contract lost its root param; the adaptive detector
				// derives the changeset root per package from its own discovery
				// coordinates (path + relativePath), so no WorkspaceRoot is needed.
				SilkPublishability.layerAdaptive.pipe(
					Layer.provide(
						Layer.mergeAll(
							platform,
							ChangesetConfig.layer.pipe(Layer.provide(ChangesetConfigReader.layer.pipe(Layer.provide(platform)))),
						),
					),
				),
				ChangesetConfig.layer.pipe(Layer.provide(ChangesetConfigReader.layer.pipe(Layer.provide(platform)))),
			),
		),
	);

describe("changeset ignore (ignore-monorepo fixture)", () => {
	it.effect("resolves the main package to exactly one targetGroup / one target", () =>
		Effect.gen(function* () {
			const targets = yield* resolveWorkspacePackage("ignore-monorepo", "package", "@fixture/ignore-main");
			expect(targets).toHaveLength(1);
			expect(targets[0].directory).toBe("dist/prod/npm/pkg");
			expect(targets[0].registry).toBe("https://registry.npmjs.org");
		}),
	);

	it.effect("excludes a @libraries/* example package despite its publishConfig.targets", () =>
		Effect.gen(function* () {
			const targets = yield* resolveWorkspacePackage("ignore-monorepo", "examples/lib", "@libraries/example");
			expect(targets).toHaveLength(0);
		}),
	);

	it.effect("excludes a @rspress/* example package despite its publishConfig.targets", () =>
		Effect.gen(function* () {
			const targets = yield* resolveWorkspacePackage("ignore-monorepo", "examples/site", "@rspress/example");
			expect(targets).toHaveLength(0);
		}),
	);
});

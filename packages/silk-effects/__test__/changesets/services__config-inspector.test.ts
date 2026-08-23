/**
 * Tests for {@link ConfigInspector}.
 *
 * Each test sets up a throwaway project directory under `os.tmpdir()` with
 * a minimal pnpm workspace structure and a `.changeset/config.json`, then
 * runs the real `ConfigInspector.layer` layer composed with
 * `ChangesetConfigReader.layer`, `WorkspacesLive`, and `NodeServices.layer`.
 * This exercises the glob-materialization and overlap-detection paths that
 * a pure mock layer would not.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Workspaces } from "@effected/workspaces";
import { Effect, Layer, Schema } from "effect";
// `vi` stays on the plain "vitest" entrypoint: vitest hoists its mock wiring above all
// imports, and a re-exported binding is not initialized in time.
import { vi } from "vitest";
import { ConfigurationError } from "../../src/changesets/errors.js";
import type { ConfigInspector as ConfigInspectorTag } from "../../src/changesets/services/config-inspector.js";
import { ConfigInspector, InspectedConfigSchema } from "../../src/changesets/services/config-inspector.js";
import { ChangesetConfigReader } from "../../src/services/ChangesetConfigReader.js";

// Compose the dependency chain explicitly so that ConfigInspector.layer's
// requirement set is fully satisfied. Layer.mergeAll alone unions
// requirements rather than threading them; `Layer.provide` is what feeds
// upstream services into downstream ones.
//
// v4/kit: `@effected/workspaces`' discovery is bound to the root its layer
// was built with (single-root by design), so the test layer is a per-fixture
// factory — build it with the fixture's cwd, never share one across tmpdirs.
const testLive = (cwd: string): Layer.Layer<ConfigInspectorTag> =>
	ConfigInspector.layer.pipe(
		Layer.provide(Layer.mergeAll(ChangesetConfigReader.layer, Workspaces.layer({ cwd }))),
		Layer.provide(NodeServices.layer),
	);

interface FixtureOptions {
	readonly rootName?: string;
	readonly rootVersion?: string;
	readonly workspacePackages?: ReadonlyArray<{
		readonly relPath: string;
		readonly name: string;
		readonly version: string;
		readonly publishConfig?: Record<string, unknown>;
	}>;
	readonly rootPublishConfig?: Record<string, unknown>;
	readonly configJson: Record<string, unknown>;
	readonly extraFiles?: ReadonlyArray<{ readonly path: string; readonly content: string }>;
}

function setupFixture(opts: FixtureOptions): string {
	const dir = mkdtempSync(join(tmpdir(), "config-inspector-"));

	// Root package.json
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify(
			{
				name: opts.rootName ?? "test-root",
				version: opts.rootVersion ?? "1.0.0",
				private: true,
				...(opts.rootPublishConfig ? { publishConfig: opts.rootPublishConfig } : {}),
				...(opts.workspacePackages && opts.workspacePackages.length > 0
					? { workspaces: opts.workspacePackages.map((p) => p.relPath) }
					: {}),
			},
			null,
			2,
		),
	);

	// WorkspaceDiscovery always requires pnpm-workspace.yaml to anchor the
	// project root. Write an empty `packages:` list when no workspace
	// packages are declared so single-package fixtures still work.
	const wsPackages = opts.workspacePackages ?? [];
	const yamlLines = ["packages:"];
	for (const p of wsPackages) {
		yamlLines.push(`  - "${p.relPath}"`);
	}
	writeFileSync(join(dir, "pnpm-workspace.yaml"), `${yamlLines.join("\n")}\n`);
	writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	for (const ws of wsPackages) {
		const wsDir = join(dir, ws.relPath);
		mkdirSync(wsDir, { recursive: true });
		writeFileSync(
			join(wsDir, "package.json"),
			JSON.stringify(
				{
					name: ws.name,
					version: ws.version,
					...(ws.publishConfig ? { publishConfig: ws.publishConfig } : {}),
				},
				null,
				2,
			),
		);
	}

	// .changeset/config.json
	mkdirSync(join(dir, ".changeset"), { recursive: true });
	writeFileSync(join(dir, ".changeset", "config.json"), `${JSON.stringify(opts.configJson, null, 2)}\n`);

	// Extra files (to materialize globs against)
	for (const f of opts.extraFiles ?? []) {
		const full = join(dir, f.path);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, f.content);
	}

	return dir;
}

function makeConfig(extraChangelogOptions: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
		changelog: ["@savvy-web/changesets/changelog", { repo: "savvy-web/changesets", ...extraChangelogOptions }],
		commit: false,
		access: "restricted",
		baseBranch: "main",
		updateInternalDependencies: "patch",
		ignore: [],
	};
}

// Per-test provide is REQUIRED throughout this file — do NOT hoist `testLive` into a
// suite-boundary `layer(...)` block. Two independent reasons:
//   1. `testLive(cwd)` is a per-fixture factory bound to a tmpdir (see its comment above);
//      sharing one across fixtures is already called out as wrong.
//   2. ConfigInspector holds a never-self-expiring per-root cache, and the `refresh` suite
//      below pins what a SECOND inspect() sees "in the same runtime". A shared layer would
//      leak that cache across tests and dissolve the exact boundary those tests cover — while
//      staying green.
const runInspect = (cwd: string) =>
	Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		return yield* inspector.inspect(cwd);
	}).pipe(Effect.provide(testLive(cwd)));

const runInspectFail = (cwd: string) =>
	Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		return yield* inspector.inspect(cwd);
	}).pipe(Effect.provide(testLive(cwd)), Effect.flip);

const runClassify = (cwd: string, paths: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		return yield* inspector.classify(cwd, paths);
	}).pipe(Effect.provide(testLive(cwd)));

describe("ConfigInspector.inspect", () => {
	const dirs: string[] = [];

	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	it.effect("returns InspectedConfig for a minimal new-shape config", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				rootName: "@scope/root",
				configJson: makeConfig(),
			});
			dirs.push(dir);

			const result = yield* runInspect(dir);
			expect(result.configPath).toBe(join(dir, ".changeset", "config.json"));
			expect(result.changelog).toBe("@savvy-web/changesets/changelog");
			expect(result.baseBranch).toBe("main");
			expect(result.access).toBe("restricted");
			expect(result.legacyVersionFilesUsed).toBe(false);
			expect(result.packages).toEqual([]);
		}),
	);

	it.effect("resolves a packages entry to its workspace directory", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "2.0.0" }],
				configJson: makeConfig({
					packages: {
						"@scope/foo": { additionalScopes: ["plugin/**"] },
					},
				}),
				extraFiles: [{ path: "plugin/SKILL.md", content: "" }],
			});
			dirs.push(dir);

			const result = yield* runInspect(dir);
			expect(result.packages).toHaveLength(1);
			const scope = result.packages[0];
			expect(scope.name).toBe("@scope/foo");
			expect(scope.workspaceDir).toBe(join(dir, "packages/foo"));
			expect(scope.version).toBe("2.0.0");
			expect(scope.additionalScopes).toEqual(["plugin/**"]);
			expect(scope.additionalScopeFiles).toEqual([join(dir, "plugin/SKILL.md")]);
		}),
	);

	it.effect("rejects a packages entry that does not resolve to a workspace package", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({ packages: { "@scope/ghost": {} } }),
			});
			dirs.push(dir);

			const err = yield* runInspectFail(dir);
			expect(err).toBeInstanceOf(ConfigurationError);
			const cfgErr = err as ConfigurationError;
			expect(cfgErr.field).toContain("@scope/ghost");
			expect(cfgErr.reason).toContain("Unknown package");
		}),
	);

	it.effect("rejects configs that declare both `packages` and the deprecated `versionFiles`", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({
					packages: { "@scope/foo": {} },
					versionFiles: [{ glob: "plugin.json", package: "@scope/foo" }],
				}),
			});
			dirs.push(dir);

			const err = yield* runInspectFail(dir);
			expect(err).toBeInstanceOf(ConfigurationError);
			expect((err as ConfigurationError).reason).toMatch(/both `packages` and the deprecated/);
		}),
	);

	it.effect("normalizes the legacy `versionFiles[]` shape and emits a deprecation warning", () =>
		Effect.gen(function* () {
			const warn = vi.spyOn(console, "warn");
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({
					versionFiles: [{ glob: "plugin/.claude-plugin/plugin.json", paths: ["$.version"], package: "@scope/foo" }],
				}),
				extraFiles: [
					{
						path: "plugin/.claude-plugin/plugin.json",
						content: JSON.stringify({ name: "p", version: "0.0.0" }, null, 2),
					},
				],
			});
			dirs.push(dir);

			const result = yield* runInspect(dir);
			expect(result.legacyVersionFilesUsed).toBe(true);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0]?.[0]).toMatch(/DEPRECATION/);
			expect(warn.mock.calls[0]?.[0]).toMatch(/Removed in 1\.0\.0/);

			// The normalized scope shows up exactly as if the user had written
			// the new shape directly.
			const scope = result.packages.find((p) => p.name === "@scope/foo");
			expect(scope?.versionFiles).toHaveLength(1);
			expect(scope?.versionFiles[0].glob).toBe("plugin/.claude-plugin/plugin.json");
			expect(scope?.versionFiles[0].paths).toEqual(["$.version"]);
			expect(scope?.versionFiles[0].matchedFiles).toEqual([join(dir, "plugin/.claude-plugin/plugin.json")]);
		}),
	);

	it.effect("rejects a legacy entry that has no `package` field", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({
					versionFiles: [{ glob: "plugin.json", paths: ["$.version"] }],
				}),
			});
			dirs.push(dir);

			const err = yield* runInspectFail(dir);
			expect(err).toBeInstanceOf(ConfigurationError);
			expect((err as ConfigurationError).reason).toMatch(/no `package` field/);
		}),
	);

	it.effect("detects additionalScopes overlap between two packages", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "packages/a", name: "@scope/a", version: "1.0.0" },
					{ relPath: "packages/b", name: "@scope/b", version: "1.0.0" },
				],
				configJson: makeConfig({
					packages: {
						"@scope/a": { additionalScopes: ["shared/**"] },
						"@scope/b": { additionalScopes: ["shared/**"] },
					},
				}),
				extraFiles: [{ path: "shared/index.ts", content: "" }],
			});
			dirs.push(dir);

			const err = yield* runInspectFail(dir);
			expect(err).toBeInstanceOf(ConfigurationError);
			expect((err as ConfigurationError).reason).toMatch(/Overlap/);
			expect((err as ConfigurationError).reason).toMatch(/@scope\/a.*@scope\/b|@scope\/b.*@scope\/a/);
		}),
	);

	it.effect("detects additionalScopes shadowing a different package's workspace directory", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "packages/a", name: "@scope/a", version: "1.0.0" },
					{ relPath: "packages/b", name: "@scope/b", version: "1.0.0" },
				],
				configJson: makeConfig({
					packages: {
						"@scope/a": { additionalScopes: ["packages/b/**"] },
					},
				}),
				extraFiles: [{ path: "packages/b/internal.ts", content: "" }],
			});
			dirs.push(dir);

			const err = yield* runInspectFail(dir);
			expect(err).toBeInstanceOf(ConfigurationError);
			expect((err as ConfigurationError).reason).toMatch(/Shadowing/);
		}),
	);

	it.effect("detects versionFiles target conflicts across packages", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "packages/a", name: "@scope/a", version: "1.0.0" },
					{ relPath: "packages/b", name: "@scope/b", version: "1.0.0" },
				],
				configJson: makeConfig({
					packages: {
						"@scope/a": { versionFiles: [{ glob: "shared/manifest.json", paths: ["$.version"] }] },
						"@scope/b": { versionFiles: [{ glob: "shared/manifest.json", paths: ["$.version"] }] },
					},
				}),
				extraFiles: [{ path: "shared/manifest.json", content: JSON.stringify({ version: "0.0.0" }) }],
			});
			dirs.push(dir);

			const err = yield* runInspectFail(dir);
			expect(err).toBeInstanceOf(ConfigurationError);
			expect((err as ConfigurationError).reason).toMatch(/Conflict/);
		}),
	);

	it.effect("rejects invalid options that fail schema validation (e.g., bad glob)", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({
					packages: { "@scope/foo": { additionalScopes: ["/absolute"] } },
				}),
			});
			dirs.push(dir);

			const err = yield* runInspectFail(dir);
			expect(err).toBeInstanceOf(ConfigurationError);
			expect((err as ConfigurationError).field).toBe("options");
		}),
	);
});

describe("ConfigInspector.classify", () => {
	const dirs: string[] = [];

	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	it.effect("returns reason='workspace' for files inside a package's workspace directory", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({ packages: { "@scope/foo": {} } }),
				extraFiles: [{ path: "packages/foo/src/index.ts", content: "" }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["packages/foo/src/index.ts"]);
			expect(result.package).toBe("@scope/foo");
			expect(result.reason).toBe("workspace");
		}),
	);

	it.effect("returns reason='additionalScope' for files matched by an additionalScopes glob", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({
					packages: { "@scope/foo": { additionalScopes: ["plugin/**"] } },
				}),
				extraFiles: [{ path: "plugin/SKILL.md", content: "" }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["plugin/SKILL.md"]);
			expect(result.package).toBe("@scope/foo");
			expect(result.reason).toEqual({ kind: "additionalScope", glob: "plugin/**" });
		}),
	);

	// Regression: pulling a private root into the release surface (#360) gave
	// it a workspaceDir equal to the project root, which contains every file in
	// the repo. Directory containment must not let that root outrank a more
	// specific claim, or a config's additionalScopes/versionFiles are silently
	// shadowed for every path outside a sub-package directory.
	it.effect("prefers additionalScopes over a versioned root package whose directory contains everything", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: {
					...makeConfig({ packages: { "@scope/foo": { additionalScopes: ["plugin/**"] } } }),
					privatePackages: { version: true },
				},
				extraFiles: [{ path: "plugin/SKILL.md", content: "" }],
			});
			dirs.push(dir);

			const inspected = yield* runInspect(dir);
			expect(inspected.packages.map((p) => p.name)).toContain("test-root");

			const [result] = yield* runClassify(dir, ["plugin/SKILL.md"]);
			expect(result.package).toBe("@scope/foo");
			expect(result.reason).toEqual({ kind: "additionalScope", glob: "plugin/**" });
		}),
	);

	it.effect("leaves a path outside the project directory unmapped even when a root scope exists", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				rootName: "private-action",
				configJson: { ...makeConfig(), privatePackages: { version: true } },
				extraFiles: [{ path: "src/index.ts", content: "" }],
			});
			dirs.push(dir);

			const [outside, absolute, inside] = yield* runClassify(dir, ["../outside-file.ts", "/etc/hosts", "src/index.ts"]);
			expect(outside?.package).toBeNull();
			expect(absolute?.package).toBeNull();
			// The control: a path genuinely inside the project still reaches the root fallback.
			expect(inside?.package).toBe("private-action");
		}),
	);

	it.effect("prefers versionFiles over a versioned root package whose directory contains everything", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: {
					...makeConfig({
						packages: {
							"@scope/foo": { versionFiles: [{ glob: "extras/manifest.json", paths: ["$.version"] }] },
						},
					}),
					privatePackages: { version: true },
				},
				extraFiles: [{ path: "extras/manifest.json", content: JSON.stringify({ version: "0.0.0" }) }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["extras/manifest.json"]);
			expect(result.package).toBe("@scope/foo");
			expect(result.reason).toEqual({ kind: "versionFile", glob: "extras/manifest.json" });
		}),
	);

	it.effect("returns reason='versionFile' for files matched by a versionFiles glob (outside additionalScopes)", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({
					packages: {
						"@scope/foo": {
							versionFiles: [{ glob: "extras/manifest.json", paths: ["$.version"] }],
						},
					},
				}),
				extraFiles: [{ path: "extras/manifest.json", content: JSON.stringify({ version: "0.0.0" }) }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["extras/manifest.json"]);
			expect(result.package).toBe("@scope/foo");
			expect(result.reason).toEqual({ kind: "versionFile", glob: "extras/manifest.json" });
		}),
	);

	it.effect("returns reason=null and package=null for unmapped paths", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({
					packages: { "@scope/foo": { additionalScopes: ["plugin/**"] } },
				}),
				extraFiles: [
					{ path: "plugin/SKILL.md", content: "" },
					{ path: "unrelated/notes.md", content: "" },
				],
			});
			dirs.push(dir);

			const results = yield* runClassify(dir, ["plugin/SKILL.md", "unrelated/notes.md"]);
			expect(results[0].package).toBe("@scope/foo");
			expect(results[1].package).toBeNull();
			expect(results[1].reason).toBeNull();
		}),
	);

	it.effect("preserves input order in the output array", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
				configJson: makeConfig({ packages: { "@scope/foo": {} } }),
				extraFiles: [
					{ path: "packages/foo/a.ts", content: "" },
					{ path: "packages/foo/b.ts", content: "" },
					{ path: "outside.txt", content: "" },
				],
			});
			dirs.push(dir);

			const results = yield* runClassify(dir, ["outside.txt", "packages/foo/b.ts", "packages/foo/a.ts"]);
			expect(results.map((r) => r.path)).toEqual(["outside.txt", "packages/foo/b.ts", "packages/foo/a.ts"]);
		}),
	);
});

describe("ConfigInspector.classify — empty-packages release-surface fallback", () => {
	const dirs: string[] = [];

	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	it.effect("attributes a file to a publishable workspace package when packages is empty", () =>
		Effect.gen(function* () {
			// setupFixture already writes package/package.json (with name +
			// publishConfig); classify a source file inside the package dir so the
			// fixture does not clobber that manifest and break WorkspaceDiscovery.
			const dir = setupFixture({
				workspacePackages: [
					{
						relPath: "package",
						name: "@savvy-web/rslib-builder",
						version: "0.2.0",
						publishConfig: { access: "public" },
					},
				],
				configJson: makeConfig(),
				extraFiles: [{ path: "package/src/index.ts", content: "" }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["package/src/index.ts"]);
			expect(result.package).toBe("@savvy-web/rslib-builder");
			expect(result.reason).toBe("workspace");
		}),
	);

	it.effect("does NOT attribute root-level files to a private root that has no publishConfig", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{
						relPath: "package",
						name: "@savvy-web/rslib-builder",
						version: "0.2.0",
						publishConfig: { access: "public" },
					},
				],
				configJson: makeConfig(),
				extraFiles: [{ path: "README.md", content: "# root" }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["README.md"]);
			expect(result.package).toBeNull();
			expect(result.reason).toBeNull();
		}),
	);

	it.effect("attributes files to a publishable single-root package", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				rootName: "silk-update-action",
				rootPublishConfig: { access: "public" },
				configJson: makeConfig(),
				extraFiles: [{ path: "src/index.ts", content: "" }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["src/index.ts"]);
			expect(result.package).toBe("silk-update-action");
			expect(result.reason).toBe("workspace");
		}),
	);

	it.effect(
		"leaves files unmapped when a single-root repo's root has no publishConfig and privatePackages is absent",
		() =>
			Effect.gen(function* () {
				const dir = setupFixture({
					rootName: "private-thing",
					configJson: makeConfig(),
					extraFiles: [{ path: "src/index.ts", content: "" }],
				});
				dirs.push(dir);

				const [result] = yield* runClassify(dir, ["src/index.ts"]);
				expect(result.package).toBeNull();
			}),
	);

	// #360 — a private single-root repo (no publishConfig) whose changeset
	// config sets `privatePackages.version: true` IS a release surface:
	// changesets versions private packages in that mode, so the root package
	// must appear in packages[] and attribute its files.
	it.effect("attributes files to a private single-root package when privatePackages.version is true (#360)", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				rootName: "private-action",
				configJson: { ...makeConfig(), privatePackages: { version: true } },
				extraFiles: [{ path: "src/index.ts", content: "" }],
			});
			dirs.push(dir);

			const inspected = yield* runInspect(dir);
			expect(inspected.packages.map((p) => p.name)).toEqual(["private-action"]);

			const [result] = yield* runClassify(dir, ["src/index.ts"]);
			expect(result.package).toBe("private-action");
			expect(result.reason).toBe("workspace");
		}),
	);

	it.effect("leaves files unmapped when privatePackages.version is false", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				rootName: "private-thing",
				configJson: { ...makeConfig(), privatePackages: { version: false, tag: true } },
				extraFiles: [{ path: "src/index.ts", content: "" }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["src/index.ts"]);
			expect(result.package).toBeNull();
			expect(result.reason).toBeNull();
		}),
	);

	it.effect("leaves files unmapped when privatePackages is false", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				rootName: "private-thing",
				configJson: { ...makeConfig(), privatePackages: false },
				extraFiles: [{ path: "src/index.ts", content: "" }],
			});
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["src/index.ts"]);
			expect(result.package).toBeNull();
			expect(result.reason).toBeNull();
		}),
	);

	// The gate change is general, not single-root-specific: a private,
	// unpublishable workspace PACKAGE also joins the release surface when
	// privatePackages.version is true.
	it.effect("includes a private workspace package in the fallback surface when privatePackages.version is true", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "package", name: "@scope/pub", version: "0.2.0", publishConfig: { access: "public" } },
					{ relPath: "internal", name: "@scope/internal", version: "0.0.1" },
				],
				configJson: { ...makeConfig(), privatePackages: { version: true } },
				extraFiles: [{ path: "internal/src/index.ts", content: "" }],
			});
			dirs.push(dir);

			const inspected = yield* runInspect(dir);
			expect(inspected.packages.map((p) => p.name).sort()).toEqual(["@scope/internal", "@scope/pub", "test-root"]);

			const [result] = yield* runClassify(dir, ["internal/src/index.ts"]);
			expect(result.package).toBe("@scope/internal");
			expect(result.reason).toBe("workspace");
		}),
	);

	it.effect("includes an ignored-but-configured package as a valid target", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "package", name: "@scope/held", version: "0.1.0", publishConfig: { access: "public" } },
				],
				configJson: makeConfig(),
				extraFiles: [{ path: "package/index.ts", content: "" }],
			});
			const cfgPath = join(dir, ".changeset", "config.json");
			const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
			cfg.ignore = ["@scope/held"];
			writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["package/index.ts"]);
			expect(result.package).toBe("@scope/held");
		}),
	);
});

describe("ConfigInspector — explicit `packages` augments release-surface discovery (#127)", () => {
	const dirs: string[] = [];

	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	// A `packages` record that exists only to annotate ONE package's
	// versionFiles must not shrink the release surface to that package. The
	// remaining publishable workspace packages must still be discovered.
	function setupSingleAnnotatedFixture(): string {
		return setupFixture({
			workspacePackages: [
				{ relPath: "packages/silk", name: "@scope/silk", version: "1.0.0", publishConfig: { access: "public" } },
				{ relPath: "packages/bundler", name: "@scope/bundler", version: "0.4.2", publishConfig: { access: "public" } },
			],
			configJson: makeConfig({
				packages: {
					"@scope/silk": { versionFiles: [{ glob: "plugins/p/plugin.json", paths: ["$.version"] }] },
				},
			}),
			extraFiles: [
				{ path: "plugins/p/plugin.json", content: JSON.stringify({ version: "0.0.0" }) },
				{ path: "packages/bundler/src/index.ts", content: "" },
			],
		});
	}

	it.effect("classifies a file in a publishable package that the `packages` record does not list", () =>
		Effect.gen(function* () {
			const dir = setupSingleAnnotatedFixture();
			dirs.push(dir);

			const [result] = yield* runClassify(dir, ["packages/bundler/src/index.ts"]);
			expect(result.package).toBe("@scope/bundler");
			expect(result.reason).toBe("workspace");
		}),
	);

	it.effect("inspect() lists both the annotated package and the discovered release-surface packages", () =>
		Effect.gen(function* () {
			const dir = setupSingleAnnotatedFixture();
			dirs.push(dir);

			const result = yield* runInspect(dir);
			expect(result.packages.map((p) => p.name).sort()).toEqual(["@scope/bundler", "@scope/silk"]);
			// The annotated package keeps its versionFiles richness.
			expect(result.packages.find((p) => p.name === "@scope/silk")?.versionFiles).toHaveLength(1);
			// The discovered package carries no versionFiles/additionalScopes.
			expect(result.packages.find((p) => p.name === "@scope/bundler")?.versionFiles).toEqual([]);
		}),
	);
});

describe("ConfigInspector.refresh (#229 — long-lived process staleness)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	function setupBaseBranchFixture(): string {
		return setupFixture({
			workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
			configJson: makeConfig(),
		});
	}

	it.effect("without refresh, a second inspect() in the same runtime still serves the cached (stale) result", () =>
		Effect.gen(function* () {
			const dir = setupBaseBranchFixture();
			dirs.push(dir);

			const program = Effect.gen(function* () {
				const inspector = yield* ConfigInspector;
				const first = yield* inspector.inspect(dir);

				const configPath = join(dir, ".changeset", "config.json");
				const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
				raw.baseBranch = "develop";
				writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`);

				const second = yield* inspector.inspect(dir);
				return { first, second };
			});

			// ONE `testLive(dir)` for BOTH inspect() calls inside `program` — that single shared
			// service instance (and its cache) IS the boundary under test. Do not split or hoist it.
			const { first, second } = yield* program.pipe(Effect.provide(testLive(dir)));
			expect(first.baseBranch).toBe("main");
			expect(second.baseBranch).toBe("main");
		}),
	);

	it.effect(
		"after refresh(), inspect() reflects an on-disk edit made since the last inspect() in the same runtime",
		() =>
			Effect.gen(function* () {
				const dir = setupBaseBranchFixture();
				dirs.push(dir);

				const program = Effect.gen(function* () {
					const inspector = yield* ConfigInspector;
					const first = yield* inspector.inspect(dir);

					const configPath = join(dir, ".changeset", "config.json");
					const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
					raw.baseBranch = "develop";
					writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`);

					yield* inspector.refresh();
					const second = yield* inspector.inspect(dir);
					return { first, second };
				});

				// ONE `testLive(dir)` for BOTH inspect() calls inside `program` — that single shared
				// service instance (and its cache) IS the boundary under test. Do not split or hoist it.
				const { first, second } = yield* program.pipe(Effect.provide(testLive(dir)));
				expect(first.baseBranch).toBe("main");
				expect(second.baseBranch).toBe("develop");
			}),
	);

	it.effect(
		"after refresh(), inspect() also reflects a newly-added workspace package (WorkspaceDiscovery staleness)",
		() =>
			Effect.gen(function* () {
				const dir = setupBaseBranchFixture();
				dirs.push(dir);

				const program = Effect.gen(function* () {
					const inspector = yield* ConfigInspector;
					const first = yield* inspector.inspect(dir);

					mkdirSync(join(dir, "packages", "bar"), { recursive: true });
					writeFileSync(
						join(dir, "packages", "bar", "package.json"),
						JSON.stringify({ name: "@scope/bar", version: "1.0.0", publishConfig: { access: "public" } }, null, 2),
					);
					writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/foo"\n  - "packages/bar"\n');

					yield* inspector.refresh();
					const second = yield* inspector.inspect(dir);
					return { first, second };
				});

				// ONE `testLive(dir)` for BOTH inspect() calls inside `program` — that single shared
				// service instance (and its cache) IS the boundary under test. Do not split or hoist it.
				const { first, second } = yield* program.pipe(Effect.provide(testLive(dir)));
				expect(first.packages.map((p) => p.name)).toEqual(["@scope/foo"]);
				expect(second.packages.map((p) => p.name).sort()).toEqual(["@scope/bar", "@scope/foo"]);
			}),
	);

	it.effect("after refreshIn(dir), inspect(dir) also reflects a newly-added workspace package (per-root refresh)", () =>
		Effect.gen(function* () {
			const dir = setupBaseBranchFixture();
			dirs.push(dir);

			const program = Effect.gen(function* () {
				const inspector = yield* ConfigInspector;
				const first = yield* inspector.inspect(dir);

				mkdirSync(join(dir, "packages", "bar"), { recursive: true });
				writeFileSync(
					join(dir, "packages", "bar", "package.json"),
					JSON.stringify({ name: "@scope/bar", version: "1.0.0", publishConfig: { access: "public" } }, null, 2),
				);
				writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/foo"\n  - "packages/bar"\n');

				// The per-root refresh (#229) with the SAME dir the inspect
				// targets — must drop that root's InspectedConfig cache AND
				// its per-root discovery memo, or the second inspect serves
				// the stale membership.
				yield* inspector.refreshIn(dir);
				const second = yield* inspector.inspect(dir);
				return { first, second };
			});

			// Same single-shared-instance discipline as the refresh() test above.
			const { first, second } = yield* program.pipe(Effect.provide(testLive(dir)));
			expect(first.packages.map((p) => p.name)).toEqual(["@scope/foo"]);
			expect(second.packages.map((p) => p.name).sort()).toEqual(["@scope/bar", "@scope/foo"]);
		}),
	);

	it.effect(
		"refreshIn(childDir) drops the cache of the root CONTAINING the directory, per the documented contract",
		() =>
			Effect.gen(function* () {
				const dir = setupBaseBranchFixture();
				dirs.push(dir);

				const program = Effect.gen(function* () {
					const inspector = yield* ConfigInspector;
					const first = yield* inspector.inspect(dir);

					const configPath = join(dir, ".changeset", "config.json");
					const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
					raw.baseBranch = "develop";
					writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`);

					// The contract is "the workspace CONTAINING directory": a refresh
					// keyed on a child directory must invalidate the /root cache, not
					// only a cache entry that happens to equal the child path.
					yield* inspector.refreshIn(join(dir, "packages", "foo"));
					const second = yield* inspector.inspect(dir);
					return { first, second };
				});

				// Same single-shared-instance discipline as the refresh() test above.
				const { first, second } = yield* program.pipe(Effect.provide(testLive(dir)));
				expect(first.baseBranch).toBe("main");
				expect(second.baseBranch).toBe("develop");
			}),
	);
});

// Real tmpdirs (not @effected/memfs) on purpose: the hint decision keys on
// whether a glob MATERIALIZES against the real kit discovery + glob walk this
// file's harness runs end-to-end (see the file header). Tmpdirs are removed in
// afterEach.
describe("ConfigInspector.classify — unmapped-file hints (#290)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	it.effect("hints a versionFiles-linked path that no longer materializes (deleted file)", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "packages/silk", name: "@scope/silk", version: "1.0.0", publishConfig: { access: "public" } },
				],
				configJson: makeConfig({
					packages: { "@scope/silk": { versionFiles: [{ glob: "plugins/*/plugin.json" }] } },
				}),
				// No plugins/ files on disk — the glob materializes to nothing, so a
				// deleted plugin.json in a branch diff lands unmapped.
			});
			dirs.push(dir);

			const [c] = yield* runClassify(dir, ["plugins/silk/plugin.json"]);
			expect(c?.package).toBeNull();
			expect(c?.reason).toEqual({
				kind: "unmappedHint",
				hint: 'versionFiles of "@scope/silk" (glob "plugins/*/plugin.json")',
			});
		}),
	);

	it.effect("hints an additionalScopes-linked path that no longer materializes", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "packages/silk", name: "@scope/silk", version: "1.0.0", publishConfig: { access: "public" } },
				],
				configJson: makeConfig({
					packages: { "@scope/silk": { additionalScopes: ["docs/silk/**"] } },
				}),
			});
			dirs.push(dir);

			const [c] = yield* runClassify(dir, ["docs/silk/guide.md"]);
			expect(c?.package).toBeNull();
			expect(c?.reason).toEqual({
				kind: "unmappedHint",
				hint: 'additionalScopes of "@scope/silk" (glob "docs/silk/**")',
			});
		}),
	);

	it.effect("hints the known markdownlint template mirror", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "packages/silk", name: "@scope/silk", version: "1.0.0", publishConfig: { access: "public" } },
				],
				configJson: makeConfig(),
			});
			dirs.push(dir);

			const [c] = yield* runClassify(dir, ["lib/configs/.markdownlint-cli2.jsonc"]);
			expect(c?.package).toBeNull();
			expect(c?.reason).toEqual({
				kind: "unmappedHint",
				hint: "mirrors the @savvy-web/silk-effects markdownlint template (src/lint/cli/templates/markdownlint.gen.ts)",
			});
		}),
	);

	it.effect("keeps a plain unmapped file's reason null", () =>
		Effect.gen(function* () {
			const dir = setupFixture({
				workspacePackages: [
					{ relPath: "packages/silk", name: "@scope/silk", version: "1.0.0", publishConfig: { access: "public" } },
				],
				configJson: makeConfig(),
			});
			dirs.push(dir);

			const [c] = yield* runClassify(dir, ["stray/notes.txt"]);
			expect(c).toEqual({ path: "stray/notes.txt", package: null, reason: null });
		}),
	);
});

// Real tmpdirs (not @effected/memfs) on purpose: these tests exercise the REAL
// kit `Workspaces.layer({ cwd })` discovery — per-call-root `listPackagesIn`
// with real-path root anchoring over an on-disk pnpm workspace — which is the
// exact #487 subject and cannot be backed by an in-memory volume. Same
// file-wide harness as every block above; tmpdirs are removed in afterEach.
describe("ConfigInspector — inspect from a nested git worktree (#487)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	/** Write one checkout's worth of fixture files into `dir` (same layout in primary and worktree). */
	const writeCheckout = (dir: string): void => {
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: "test-root", version: "1.0.0", private: true, workspaces: ["packages/silk"] }, null, 2),
		);
		writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/silk"\n');
		writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
		mkdirSync(join(dir, "packages", "silk"), { recursive: true });
		writeFileSync(
			join(dir, "packages", "silk", "package.json"),
			JSON.stringify({ name: "@scope/silk", version: "1.0.0", publishConfig: { access: "public" } }, null, 2),
		);
		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			`${JSON.stringify(
				{
					...makeConfig({ packages: { "@scope/silk": { additionalScopes: ["plugins/silk/**"] } } }),
				},
				null,
				2,
			)}\n`,
		);
		mkdirSync(join(dir, "plugins", "silk"), { recursive: true });
		writeFileSync(join(dir, "plugins", "silk", "plugin.json"), "{}\n");
	};

	it.effect("inspects the WORKTREE root even though the kit discovery layer is bound to the primary checkout", () =>
		Effect.gen(function* () {
			// The worktree is NESTED inside the primary checkout — the shape agent
			// worktrees (.claude/worktrees/*) have, and what makes the primary
			// root "contain" every worktree path in the shadowing check.
			const primary = mkdtempSync(join(tmpdir(), "config-inspector-wt-"));
			dirs.push(primary);
			writeCheckout(primary);
			const worktree = join(primary, ".claude", "worktrees", "wt");
			writeCheckout(worktree);

			// The worktree's branch ADDS a package the primary checkout does not
			// have. Per-call-root discovery (`listPackagesIn`) must see it — the
			// old relativePath re-rooting could only rewrite the primary root's
			// membership onto worktree paths, so this package was invisible.
			writeFileSync(join(worktree, "pnpm-workspace.yaml"), 'packages:\n  - "packages/silk"\n  - "packages/extra"\n');
			mkdirSync(join(worktree, "packages", "extra"), { recursive: true });
			writeFileSync(
				join(worktree, "packages", "extra", "package.json"),
				JSON.stringify({ name: "@scope/extra", version: "2.0.0", publishConfig: { access: "public" } }, null, 2),
			);

			// Discovery bound to the PRIMARY root; inspect() called with the
			// worktree — exactly the savvy-mcp server shape (#487).
			const program = Effect.gen(function* () {
				const inspector = yield* ConfigInspector;
				const inspected = yield* inspector.inspect(worktree);
				const classified = yield* inspector.classify(worktree, ["plugins/silk/plugin.json"]);
				return { inspected, classified };
			});
			const { inspected, classified } = yield* program.pipe(Effect.provide(testLive(primary)));

			expect(inspected.projectDir).toBe(worktree);
			const silk = inspected.packages.find((p) => p.name === "@scope/silk");
			expect(silk?.workspaceDir).toBe(join(worktree, "packages", "silk"));

			// The worktree-only package IS part of the inspected release surface.
			const extra = inspected.packages.find((p) => p.name === "@scope/extra");
			expect(extra?.workspaceDir).toBe(join(worktree, "packages", "extra"));
			expect(extra?.version).toBe("2.0.0");
			expect(silk?.additionalScopeFiles).toContain(join(worktree, "plugins", "silk", "plugin.json"));
			expect(classified[0]).toEqual({
				path: "plugins/silk/plugin.json",
				package: "@scope/silk",
				reason: { kind: "additionalScope", glob: "plugins/silk/**" },
			});
		}),
	);
});

describe("InspectedConfigSchema", () => {
	it("decodes a resolved config shape", () => {
		const sample = {
			configPath: "/repo/.changeset/config.json",
			projectDir: "/repo",
			changelog: "@savvy-web/changesets/changelog",
			baseBranch: "main",
			access: "public" as const,
			ignore: [] as string[],
			packages: [
				{
					name: "@scope/foo",
					workspaceDir: "/repo/packages/foo",
					version: "1.0.0",
					additionalScopes: [] as string[],
					additionalScopeFiles: [] as string[],
					versionFiles: [] as Array<{ glob: string; paths: string[]; matchedFiles: string[] }>,
				},
			],
			legacyVersionFilesUsed: false,
		};
		const decoded = Schema.decodeUnknownSync(InspectedConfigSchema)(sample);
		expect(decoded.packages[0].name).toBe("@scope/foo");
	});
});

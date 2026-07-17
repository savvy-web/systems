/**
 * Tests for {@link ConfigInspector}.
 *
 * Each test sets up a throwaway project directory under `os.tmpdir()` with
 * a minimal pnpm workspace structure and a `.changeset/config.json`, then
 * runs the real {@link ConfigInspectorLive} layer composed with
 * `ChangesetConfigReaderLive`, `WorkspacesLive`, and `NodeServices.layer`.
 * This exercises the glob-materialization and overlap-detection paths that
 * a pure mock layer would not.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Workspaces } from "@effected/workspaces";
import { Effect, Layer, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError } from "../../src/changesets/errors.js";
import type { ConfigInspector as ConfigInspectorTag } from "../../src/changesets/services/config-inspector.js";
import {
	ConfigInspector,
	ConfigInspectorLive,
	InspectedConfigSchema,
} from "../../src/changesets/services/config-inspector.js";
import { ChangesetConfigReaderLive } from "../../src/services/ChangesetConfigReader.js";

// Compose the dependency chain explicitly so that ConfigInspectorLive's
// requirement set is fully satisfied. Layer.mergeAll alone unions
// requirements rather than threading them; `Layer.provide` is what feeds
// upstream services into downstream ones.
//
// v4/kit: `@effected/workspaces`' discovery is bound to the root its layer
// was built with (single-root by design), so the test layer is a per-fixture
// factory — build it with the fixture's cwd, never share one across tmpdirs.
const testLive = (cwd: string): Layer.Layer<ConfigInspectorTag> =>
	ConfigInspectorLive.pipe(
		Layer.provide(Layer.mergeAll(ChangesetConfigReaderLive, Workspaces.layer({ cwd }))),
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

const runInspect = (cwd: string) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const inspector = yield* ConfigInspector;
			return yield* inspector.inspect(cwd);
		}).pipe(Effect.provide(testLive(cwd))),
	);

const runInspectFail = (cwd: string) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const inspector = yield* ConfigInspector;
			return yield* inspector.inspect(cwd);
		}).pipe(Effect.provide(testLive(cwd)), Effect.flip),
	);

const runClassify = (cwd: string, paths: ReadonlyArray<string>) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const inspector = yield* ConfigInspector;
			return yield* inspector.classify(cwd, paths);
		}).pipe(Effect.provide(testLive(cwd))),
	);

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

	it("returns InspectedConfig for a minimal new-shape config", async () => {
		const dir = setupFixture({
			rootName: "@scope/root",
			configJson: makeConfig(),
		});
		dirs.push(dir);

		const result = await runInspect(dir);
		expect(result.configPath).toBe(join(dir, ".changeset", "config.json"));
		expect(result.changelog).toBe("@savvy-web/changesets/changelog");
		expect(result.baseBranch).toBe("main");
		expect(result.access).toBe("restricted");
		expect(result.legacyVersionFilesUsed).toBe(false);
		expect(result.packages).toEqual([]);
	});

	it("resolves a packages entry to its workspace directory", async () => {
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

		const result = await runInspect(dir);
		expect(result.packages).toHaveLength(1);
		const scope = result.packages[0];
		expect(scope.name).toBe("@scope/foo");
		expect(scope.workspaceDir).toBe(join(dir, "packages/foo"));
		expect(scope.version).toBe("2.0.0");
		expect(scope.additionalScopes).toEqual(["plugin/**"]);
		expect(scope.additionalScopeFiles).toEqual([join(dir, "plugin/SKILL.md")]);
	});

	it("rejects a packages entry that does not resolve to a workspace package", async () => {
		const dir = setupFixture({
			workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
			configJson: makeConfig({ packages: { "@scope/ghost": {} } }),
		});
		dirs.push(dir);

		const err = await runInspectFail(dir);
		expect(err).toBeInstanceOf(ConfigurationError);
		const cfgErr = err as ConfigurationError;
		expect(cfgErr.field).toContain("@scope/ghost");
		expect(cfgErr.reason).toContain("Unknown package");
	});

	it("rejects configs that declare both `packages` and the deprecated `versionFiles`", async () => {
		const dir = setupFixture({
			workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
			configJson: makeConfig({
				packages: { "@scope/foo": {} },
				versionFiles: [{ glob: "plugin.json", package: "@scope/foo" }],
			}),
		});
		dirs.push(dir);

		const err = await runInspectFail(dir);
		expect(err).toBeInstanceOf(ConfigurationError);
		expect((err as ConfigurationError).reason).toMatch(/both `packages` and the deprecated/);
	});

	it("normalizes the legacy `versionFiles[]` shape and emits a deprecation warning", async () => {
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

		const result = await runInspect(dir);
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
	});

	it("rejects a legacy entry that has no `package` field", async () => {
		const dir = setupFixture({
			workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
			configJson: makeConfig({
				versionFiles: [{ glob: "plugin.json", paths: ["$.version"] }],
			}),
		});
		dirs.push(dir);

		const err = await runInspectFail(dir);
		expect(err).toBeInstanceOf(ConfigurationError);
		expect((err as ConfigurationError).reason).toMatch(/no `package` field/);
	});

	it("detects additionalScopes overlap between two packages", async () => {
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

		const err = await runInspectFail(dir);
		expect(err).toBeInstanceOf(ConfigurationError);
		expect((err as ConfigurationError).reason).toMatch(/Overlap/);
		expect((err as ConfigurationError).reason).toMatch(/@scope\/a.*@scope\/b|@scope\/b.*@scope\/a/);
	});

	it("detects additionalScopes shadowing a different package's workspace directory", async () => {
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

		const err = await runInspectFail(dir);
		expect(err).toBeInstanceOf(ConfigurationError);
		expect((err as ConfigurationError).reason).toMatch(/Shadowing/);
	});

	it("detects versionFiles target conflicts across packages", async () => {
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

		const err = await runInspectFail(dir);
		expect(err).toBeInstanceOf(ConfigurationError);
		expect((err as ConfigurationError).reason).toMatch(/Conflict/);
	});

	it("rejects invalid options that fail schema validation (e.g., bad glob)", async () => {
		const dir = setupFixture({
			workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
			configJson: makeConfig({
				packages: { "@scope/foo": { additionalScopes: ["/absolute"] } },
			}),
		});
		dirs.push(dir);

		const err = await runInspectFail(dir);
		expect(err).toBeInstanceOf(ConfigurationError);
		expect((err as ConfigurationError).field).toBe("options");
	});
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

	it("returns reason='workspace' for files inside a package's workspace directory", async () => {
		const dir = setupFixture({
			workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
			configJson: makeConfig({ packages: { "@scope/foo": {} } }),
			extraFiles: [{ path: "packages/foo/src/index.ts", content: "" }],
		});
		dirs.push(dir);

		const [result] = await runClassify(dir, ["packages/foo/src/index.ts"]);
		expect(result.package).toBe("@scope/foo");
		expect(result.reason).toBe("workspace");
	});

	it("returns reason='additionalScope' for files matched by an additionalScopes glob", async () => {
		const dir = setupFixture({
			workspacePackages: [{ relPath: "packages/foo", name: "@scope/foo", version: "1.0.0" }],
			configJson: makeConfig({
				packages: { "@scope/foo": { additionalScopes: ["plugin/**"] } },
			}),
			extraFiles: [{ path: "plugin/SKILL.md", content: "" }],
		});
		dirs.push(dir);

		const [result] = await runClassify(dir, ["plugin/SKILL.md"]);
		expect(result.package).toBe("@scope/foo");
		expect(result.reason).toEqual({ kind: "additionalScope", glob: "plugin/**" });
	});

	it("returns reason='versionFile' for files matched by a versionFiles glob (outside additionalScopes)", async () => {
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

		const [result] = await runClassify(dir, ["extras/manifest.json"]);
		expect(result.package).toBe("@scope/foo");
		expect(result.reason).toEqual({ kind: "versionFile", glob: "extras/manifest.json" });
	});

	it("returns reason=null and package=null for unmapped paths", async () => {
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

		const results = await runClassify(dir, ["plugin/SKILL.md", "unrelated/notes.md"]);
		expect(results[0].package).toBe("@scope/foo");
		expect(results[1].package).toBeNull();
		expect(results[1].reason).toBeNull();
	});

	it("preserves input order in the output array", async () => {
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

		const results = await runClassify(dir, ["outside.txt", "packages/foo/b.ts", "packages/foo/a.ts"]);
		expect(results.map((r) => r.path)).toEqual(["outside.txt", "packages/foo/b.ts", "packages/foo/a.ts"]);
	});
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

	it("attributes a file to a publishable workspace package when packages is empty", async () => {
		// setupFixture already writes package/package.json (with name +
		// publishConfig); classify a source file inside the package dir so the
		// fixture does not clobber that manifest and break WorkspaceDiscovery.
		const dir = setupFixture({
			workspacePackages: [
				{ relPath: "package", name: "@savvy-web/rslib-builder", version: "0.2.0", publishConfig: { access: "public" } },
			],
			configJson: makeConfig(),
			extraFiles: [{ path: "package/src/index.ts", content: "" }],
		});
		dirs.push(dir);

		const [result] = await runClassify(dir, ["package/src/index.ts"]);
		expect(result.package).toBe("@savvy-web/rslib-builder");
		expect(result.reason).toBe("workspace");
	});

	it("does NOT attribute root-level files to a private root that has no publishConfig", async () => {
		const dir = setupFixture({
			workspacePackages: [
				{ relPath: "package", name: "@savvy-web/rslib-builder", version: "0.2.0", publishConfig: { access: "public" } },
			],
			configJson: makeConfig(),
			extraFiles: [{ path: "README.md", content: "# root" }],
		});
		dirs.push(dir);

		const [result] = await runClassify(dir, ["README.md"]);
		expect(result.package).toBeNull();
		expect(result.reason).toBeNull();
	});

	it("attributes files to a publishable single-root package", async () => {
		const dir = setupFixture({
			rootName: "silk-update-action",
			rootPublishConfig: { access: "public" },
			configJson: makeConfig(),
			extraFiles: [{ path: "src/index.ts", content: "" }],
		});
		dirs.push(dir);

		const [result] = await runClassify(dir, ["src/index.ts"]);
		expect(result.package).toBe("silk-update-action");
		expect(result.reason).toBe("workspace");
	});

	it("leaves files unmapped when a single-root repo's root has no publishConfig", async () => {
		const dir = setupFixture({
			rootName: "private-thing",
			configJson: makeConfig(),
			extraFiles: [{ path: "src/index.ts", content: "" }],
		});
		dirs.push(dir);

		const [result] = await runClassify(dir, ["src/index.ts"]);
		expect(result.package).toBeNull();
	});

	it("includes an ignored-but-configured package as a valid target", async () => {
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

		const [result] = await runClassify(dir, ["package/index.ts"]);
		expect(result.package).toBe("@scope/held");
	});
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

	it("classifies a file in a publishable package that the `packages` record does not list", async () => {
		const dir = setupSingleAnnotatedFixture();
		dirs.push(dir);

		const [result] = await runClassify(dir, ["packages/bundler/src/index.ts"]);
		expect(result.package).toBe("@scope/bundler");
		expect(result.reason).toBe("workspace");
	});

	it("inspect() lists both the annotated package and the discovered release-surface packages", async () => {
		const dir = setupSingleAnnotatedFixture();
		dirs.push(dir);

		const result = await runInspect(dir);
		expect(result.packages.map((p) => p.name).sort()).toEqual(["@scope/bundler", "@scope/silk"]);
		// The annotated package keeps its versionFiles richness.
		expect(result.packages.find((p) => p.name === "@scope/silk")?.versionFiles).toHaveLength(1);
		// The discovered package carries no versionFiles/additionalScopes.
		expect(result.packages.find((p) => p.name === "@scope/bundler")?.versionFiles).toEqual([]);
	});
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

	it("without refresh, a second inspect() in the same runtime still serves the cached (stale) result", async () => {
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

		const { first, second } = await Effect.runPromise(program.pipe(Effect.provide(testLive(dir))));
		expect(first.baseBranch).toBe("main");
		expect(second.baseBranch).toBe("main");
	});

	it("after refresh(), inspect() reflects an on-disk edit made since the last inspect() in the same runtime", async () => {
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

		const { first, second } = await Effect.runPromise(program.pipe(Effect.provide(testLive(dir))));
		expect(first.baseBranch).toBe("main");
		expect(second.baseBranch).toBe("develop");
	});

	it("after refresh(), inspect() also reflects a newly-added workspace package (WorkspaceDiscovery staleness)", async () => {
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

		const { first, second } = await Effect.runPromise(program.pipe(Effect.provide(testLive(dir))));
		expect(first.packages.map((p) => p.name)).toEqual(["@scope/foo"]);
		expect(second.packages.map((p) => p.name).sort()).toEqual(["@scope/bar", "@scope/foo"]);
	});
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

/**
 * Tests for {@link ConfigInspector}.
 *
 * Each test sets up a throwaway project directory under `os.tmpdir()` with
 * a minimal pnpm workspace structure and a `.changeset/config.json`, then
 * runs the real {@link ConfigInspectorLive} layer composed with
 * `ChangesetConfigReaderLive`, `WorkspacesLive`, and `NodeContext.layer`.
 * This exercises the glob-materialization and overlap-detection paths that
 * a pure mock layer would not.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacesLive } from "workspaces-effect";
import { ConfigurationError } from "../../src/changesets/errors.js";
import { ConfigInspector, ConfigInspectorLive } from "../../src/changesets/services/config-inspector.js";
import { ChangesetConfigReaderLive } from "../../src/services/ChangesetConfigReader.js";

// Compose the dependency chain explicitly so that ConfigInspectorLive's
// requirement set is fully satisfied. Layer.mergeAll alone unions
// requirements rather than threading them; `Layer.provide` is what feeds
// upstream services into downstream ones.
const TestLive = ConfigInspectorLive.pipe(
	Layer.provide(Layer.mergeAll(ChangesetConfigReaderLive, WorkspacesLive)),
	Layer.provide(NodeContext.layer),
);

interface FixtureOptions {
	readonly rootName?: string;
	readonly rootVersion?: string;
	readonly workspacePackages?: ReadonlyArray<{
		readonly relPath: string;
		readonly name: string;
		readonly version: string;
	}>;
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
		writeFileSync(join(wsDir, "package.json"), JSON.stringify({ name: ws.name, version: ws.version }, null, 2));
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
		}).pipe(Effect.provide(TestLive)),
	);

const runInspectFail = (cwd: string) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const inspector = yield* ConfigInspector;
			return yield* inspector.inspect(cwd);
		}).pipe(Effect.provide(TestLive), Effect.flip),
	);

const runClassify = (cwd: string, paths: ReadonlyArray<string>) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const inspector = yield* ConfigInspector;
			return yield* inspector.classify(cwd, paths);
		}).pipe(Effect.provide(TestLive)),
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

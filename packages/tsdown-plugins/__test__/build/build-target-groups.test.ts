// packages/tsdown-plugins/__test__/build/build-target-groups.test.ts
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildTargetGroups } from "../../src/build/build-target-groups.js";
import { BuildCollector } from "../../src/report/collector.js";

describe("buildTargetGroups", () => {
	it("runs a JS pass + a dts pass per group (two passes to the same outDir)", async () => {
		const calls: Array<{
			outDir: string;
			plugins: number;
			hasManifest: boolean;
			dts: unknown;
			unbundle: unknown;
			clean: unknown;
		}> = [];
		const fakeBuild = vi.fn(
			async (cfg: {
				outDir: string;
				plugins: Array<{ name?: string }>;
				dts: unknown;
				unbundle: unknown;
				clean: unknown;
			}) => {
				calls.push({
					outDir: cfg.outDir,
					plugins: cfg.plugins.length,
					hasManifest: cfg.plugins.some((p) => p.name === "savvy:emit-manifest"),
					dts: cfg.dts,
					unbundle: cfg.unbundle,
					clean: cfg.clean,
				});
				return [];
			},
		);
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "./src/index.ts" },
			tsconfigPath: "/tmp/t.json",
			groups: [
				{ id: "dev", name: "base" },
				{ id: "npm", name: "base" },
			],
			devManifest: "preserve",
			build: fakeBuild as never,
		});
		// 2 groups x 2 passes = 4 calls.
		expect(fakeBuild).toHaveBeenCalledTimes(4);

		// Group "dev": JS pass then dts pass, both to dist/dev/pkg.
		const [devJs, devDts, npmJs, npmDts] = calls;
		expect(devJs.outDir).toBe("/abs/pkg/dist/dev/pkg");
		expect(devDts.outDir).toBe("/abs/pkg/dist/dev/pkg");
		expect(npmJs.outDir).toBe("/abs/pkg/dist/prod/npm/pkg");
		expect(npmDts.outDir).toBe("/abs/pkg/dist/prod/npm/pkg");

		// JS pass: per-module JS, no dts, manifest plugin present, fresh outDir.
		expect(devJs.hasManifest).toBe(true);
		expect(devJs.dts).toBe(false);
		expect(devJs.unbundle).toBe(true);
		expect(devJs.clean).toBe(true);

		// dts pass: bundled declarations only, NO manifest plugin, clean:false (keep JS pass output).
		expect(devDts.hasManifest).toBe(false);
		expect(devDts.dts).toEqual({ tsconfig: "/tmp/t.json", emitDtsOnly: true, generator: "tsc" });
		expect(devDts.unbundle).toBe(false);
		expect(devDts.clean).toBe(false);
	});

	it("runs one dts build PER entry for a multi-entry partition (single-entry rollups, no shared chunk)", async () => {
		// The determinism fix (#185): a multi-entry partition must NOT roll all entries through one
		// dts pass — rolldown then code-splits the shared declarations into a content-hashed sibling
		// chunk whose name/layout is non-deterministic. One single-entry rollup per entry is
		// deterministic by construction and self-contained. The JS pass stays a single per-module pass
		// over all entries; only the dts pass splits.
		const passes: Array<{ kind: "js" | "dts"; entry: Record<string, string> }> = [];
		const build = (async (cfg: { dts: unknown; entry: Record<string, string> }) => {
			passes.push({ kind: cfg.dts === false ? "js" : "dts", entry: cfg.entry });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "./src/index.ts", testing: "./src/testing.ts" },
			tsconfigPath: "/tmp/t.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build,
		});
		const js = passes.filter((p) => p.kind === "js");
		const dts = passes.filter((p) => p.kind === "dts");
		// One JS pass over all entries (per-module).
		expect(js.length).toBe(1);
		expect(js[0]?.entry).toEqual({ index: "./src/index.ts", testing: "./src/testing.ts" });
		// One dts pass per entry, each a single-entry map (the deterministic property).
		expect(dts.length).toBe(2);
		for (const d of dts) expect(Object.keys(d.entry)).toHaveLength(1);
		expect(dts.map((d) => d.entry).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual([
			{ index: "./src/index.ts" },
			{ testing: "./src/testing.ts" },
		]);
	});

	it("emits a re-export STUB for a pure-barrel secondary entry instead of a second dts rollup (#185)", async () => {
		// A `./testing`-style entry that purely re-exports a subset of the primary `index` entry is
		// emitted as a thin `export { … } from "./index.js"` stub — index is the only entry that gets a
		// self-contained dts rollup, keeping the package compact without a shared chunk.
		const dir = await mkdtemp(join(tmpdir(), "btg-stub-"));
		await mkdir(join(dir, "src"), { recursive: true });
		await writeFile(join(dir, "src/index.ts"), "export const A = 1;\nexport const B = 2;\nexport type T = string;\n");
		await writeFile(
			join(dir, "src/testing.ts"),
			'export { A } from "./index.js";\nexport type { T } from "./index.js";\n',
		);

		const dtsEntries: Array<Record<string, string>> = [];
		const build = (async (cfg: { dts: unknown; entry: Record<string, string>; outDir: string }) => {
			if (cfg.dts !== false) dtsEntries.push(cfg.entry);
			// The real JS pass creates/owns the outDir; mirror that so the stub writeFileSync has a dir.
			await mkdir(cfg.outDir, { recursive: true });
		}) as never;
		await buildTargetGroups({
			cwd: dir,
			version: "1.0.0",
			entry: { index: "./src/index.ts", testing: "./src/testing.ts" },
			tsconfigPath: join(dir, "tsconfig.json"),
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build,
		});
		// Only the base `index` entry is rolled up; `testing` is a stub, not a dts build.
		expect(dtsEntries).toEqual([{ index: "./src/index.ts" }]);
		const stub = await readFile(join(dir, "dist/dev/pkg/testing.d.ts"), "utf-8");
		expect(stub).toBe('export { A } from "./index.js";\nexport type { T } from "./index.js";\n');
	}, 30_000);

	it("does NOT stub a secondary entry that is not a pure re-export barrel (keeps it self-contained)", async () => {
		// `testing` here declares a local symbol, so it is NOT expressible as a stub of index — it must
		// get its own self-contained dts rollup (two dts builds, no stub file written).
		const dir = await mkdtemp(join(tmpdir(), "btg-nostub-"));
		await mkdir(join(dir, "src"), { recursive: true });
		await writeFile(join(dir, "src/index.ts"), "export const A = 1;\n");
		await writeFile(join(dir, "src/testing.ts"), 'export { A } from "./index.js";\nexport const own = 2;\n');

		const dtsEntries: Array<Record<string, string>> = [];
		const build = (async (cfg: { dts: unknown; entry: Record<string, string>; outDir: string }) => {
			if (cfg.dts !== false) dtsEntries.push(cfg.entry);
			await mkdir(cfg.outDir, { recursive: true });
		}) as never;
		await buildTargetGroups({
			cwd: dir,
			version: "1.0.0",
			entry: { index: "./src/index.ts", testing: "./src/testing.ts" },
			tsconfigPath: join(dir, "tsconfig.json"),
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build,
		});
		// Both entries get a self-contained rollup; no stub short-circuit.
		expect(dtsEntries).toHaveLength(2);
		expect(dtsEntries.map((e) => Object.keys(e)[0]).sort()).toEqual(["index", "testing"]);
	}, 30_000);

	it("builds once per group spec, threading the spec's name into the manifest pipeline", async () => {
		const dir = await mkdtemp(join(tmpdir(), "btg-"));
		await writeFile(join(dir, "package.json"), JSON.stringify({ name: "base", version: "1.0.0" }));
		// Make the temp dir its own workspace root so resolveManifest assembles an empty catalog
		// set instead of walking up to the host workspace (90-entry catalogs + large lockfile).
		await writeFile(join(dir, "pnpm-workspace.yaml"), "packages: []\n");

		const calls: Array<{ outDir: string }> = [];
		// Drive each group's emitManifest plugin so the injected transform fires with the
		// real TargetGroupRef, exposing the name the manifest pipeline actually sees.
		const build = (async (cfg: {
			outDir: string;
			plugins: Array<{ name: string; generateBundle?: () => Promise<void> }>;
		}) => {
			calls.push({ outDir: cfg.outDir });
			const emit = cfg.plugins.find((p) => p.name === "savvy:emit-manifest");
			await emit?.generateBundle?.call({ emitFile() {} });
		}) as never;

		const seenNames: string[] = [];
		const prevCwd = process.cwd();
		process.chdir(dir);
		try {
			await buildTargetGroups({
				cwd: dir,
				version: "1.0.0",
				entry: { index: "src/index.ts" },
				tsconfigPath: join(dir, "tsconfig.json"),
				groups: [
					{ id: "npm", name: "base" },
					{ id: "github", name: "@scope/base" },
				],
				devManifest: "preserve",
				transform: ({ pkg, targetGroup }) => {
					seenNames.push(targetGroup.name);
					return pkg;
				},
				build,
			});
		} finally {
			process.chdir(prevCwd);
		}

		// Two passes per group share an outDir, so dedup before comparing.
		expect([...new Set(calls.map((c) => c.outDir))].sort()).toEqual([
			join(dir, "dist/prod/github/pkg"),
			join(dir, "dist/prod/npm/pkg"),
		]);
		// The manifest transform fires once per group (JS pass only), not on the dts pass.
		expect(seenNames.sort()).toEqual(["@scope/base", "base"]);
	}, 30_000); // real fs (mkdtemp + manifest read) can starve past the 5s default under full-suite load

	it("never sets rolldown inputOptions on any pass (JSX is applied via the tsconfig, issue #170)", async () => {
		const captured: Array<{ inputOptions: unknown }> = [];
		const build = (async (cfg: { inputOptions?: unknown }) => {
			captured.push({ inputOptions: cfg.inputOptions });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build,
		});
		// A top-level `jsx` in rolldown inputOptions is invalid ("Expected never"); the build must
		// never forward one — every pass leaves inputOptions undefined.
		expect(captured.length).toBeGreaterThan(0);
		for (const c of captured) expect(c.inputOptions).toBeUndefined();
	});

	it("attaches the cjs-default-interop plugin to BOTH the JS and dts passes only when format includes cjs", async () => {
		// Capture plugin names per pass. The JS pass has dts === false; the dts pass has dts
		// !== false (the emitDtsOnly pass). The dts-pass attachment is LOAD-BEARING: tsdown's
		// dts pass re-emits the .cjs for dual format and would overwrite the JS pass's footer,
		// so the interop plugin MUST be present there too (a refactor dropping it would silently
		// regress the lint:md fix while every JS-pass-only assertion still passes).
		const passes: Array<{ kind: "js" | "dts"; plugins: Array<string> }> = [];
		const build = (async (cfg: { dts: unknown; plugins: Array<{ name?: string }> }) => {
			passes.push({
				kind: cfg.dts === false ? "js" : "dts",
				plugins: cfg.plugins.map((p) => p.name ?? ""),
			});
		}) as never;

		// esm-only (default): interop plugin absent from BOTH passes.
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build,
		});
		const esmJs = passes.find((p) => p.kind === "js");
		const esmDts = passes.find((p) => p.kind === "dts");
		expect(esmJs?.plugins).not.toContain("savvy:cjs-default-interop");
		expect(esmDts?.plugins).not.toContain("savvy:cjs-default-interop");

		// dual esm+cjs: interop plugin present on BOTH the JS pass and the dts pass.
		passes.length = 0;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			format: ["esm", "cjs"],
			build,
		});
		const dualJs = passes.find((p) => p.kind === "js");
		const dualDts = passes.find((p) => p.kind === "dts");
		expect(dualJs?.plugins).toContain("savvy:cjs-default-interop");
		expect(dualDts?.plugins).toContain("savvy:cjs-default-interop");
	});

	it("emits dual import/require export conditions when format includes cjs", async () => {
		const dir = await mkdtemp(join(tmpdir(), "btg-"));
		await writeFile(
			join(dir, "package.json"),
			JSON.stringify({ name: "base", version: "1.0.0", exports: { ".": "./src/index.ts" } }),
		);

		// Drive the emitManifest plugin's generateBundle hook, capturing the emitted package.json.
		const captureBuild = (manifests: Array<Record<string, unknown>>) =>
			(async (cfg: { plugins: Array<{ name: string; generateBundle?: () => Promise<void> }> }) => {
				const emit = cfg.plugins.find((p) => p.name === "savvy:emit-manifest");
				await emit?.generateBundle?.call({
					emitFile(file: { fileName: string; source: string }) {
						if (file.fileName === "package.json") manifests.push(JSON.parse(file.source));
					},
				});
			}) as never;

		const dual: Array<Record<string, unknown>> = [];
		await buildTargetGroups({
			cwd: dir,
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: join(dir, "tsconfig.json"),
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			format: ["esm", "cjs"],
			build: captureBuild(dual),
		});
		expect((dual[0]?.exports as Record<string, unknown>)["."]).toEqual({
			types: "./index.d.ts",
			import: "./index.js",
			require: "./index.cjs",
			default: "./index.js",
		});

		const esm: Array<Record<string, unknown>> = [];
		await buildTargetGroups({
			cwd: dir,
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: join(dir, "tsconfig.json"),
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build: captureBuild(esm),
		});
		expect((esm[0]?.exports as Record<string, unknown>)["."]).toEqual({
			types: "./index.d.ts",
			import: "./index.js",
			default: "./index.js",
		});
	}, 30_000); // real fs (mkdtemp + manifest read) can starve past the 5s default under full-suite load

	it("enables cjs interop on the tsdown build when cjs is in the format", async () => {
		const captured: Array<Record<string, unknown>> = [];
		const build = (async (cfg: Record<string, unknown>) => {
			captured.push(cfg);
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			format: ["esm", "cjs"],
			build,
		});
		expect(captured[0]?.cjsDefault).toBe(true);
	});

	it("omits cjs interop when the format is esm-only", async () => {
		const captured: Array<Record<string, unknown>> = [];
		const build = (async (cfg: Record<string, unknown>) => {
			captured.push(cfg);
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build,
		});
		expect(captured[0]?.cjsDefault).toBeUndefined();
	});

	it("passes the configured format through to the tsdown build", async () => {
		const captured: Array<{ format?: unknown }> = [];
		const build = (async (cfg: { format?: unknown }) => {
			captured.push({ format: cfg.format });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			format: ["esm", "cjs"],
			build,
		});
		expect(captured[0]?.format).toEqual(["esm", "cjs"]);
	});

	it("threads `bundle` into the JS-pass deps.alwaysBundle (force-inline), alongside neverBundle", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["effect"],
			bundle: ["semver-effect", "@savvy-web/silk-effects"],
			build,
		});
		// [0] = JS pass: alwaysBundle present (force-inline), coexisting with neverBundle.
		expect((captured[0]?.deps as { alwaysBundle?: unknown })?.alwaysBundle).toEqual([
			"semver-effect",
			"@savvy-web/silk-effects",
		]);
		expect((captured[0]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["effect"]);
		// JS-pass-only: the dts pass does NOT carry alwaysBundle from `bundle`.
		expect((captured[1]?.deps as { alwaysBundle?: unknown } | undefined)?.alwaysBundle).toBeUndefined();
	});

	it("omits alwaysBundle when `bundle` is not set", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["effect"],
			build,
		});
		expect((captured[0]?.deps as { alwaysBundle?: unknown } | undefined)?.alwaysBundle).toBeUndefined();
	});

	it("inlines bundledPackages in the dts pass via skipNodeModulesBundle + deps.dts.alwaysBundle, not the JS pass", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["typescript"],
			bundledPackages: ["@commitlint/types"],
			build,
		});
		// [0] = JS pass, [1] = dts pass for the single group.
		// JS pass must NOT carry the dts-only inlining knobs.
		expect((captured[0]?.deps as { onlyBundle?: unknown } | undefined)?.onlyBundle).toBeUndefined();
		expect(
			(captured[0]?.deps as { skipNodeModulesBundle?: unknown } | undefined)?.skipNodeModulesBundle,
		).toBeUndefined();
		expect((captured[0]?.deps as { dts?: unknown } | undefined)?.dts).toBeUndefined();
		// dts pass: externalize all node_modules, force-bundle only the listed packages.
		// onlyBundle is intentionally NOT used (it puts tsdown into strict mode).
		expect((captured[1]?.deps as { onlyBundle?: unknown })?.onlyBundle).toBeUndefined();
		expect((captured[1]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(true);
		expect((captured[1]?.deps as { dts?: { alwaysBundle?: unknown } })?.dts?.alwaysBundle).toEqual([
			"@commitlint/types",
		]);
		// neverBundle (externals) still applies on the dts pass too.
		expect((captured[1]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["typescript"]);
	});

	it("inlines bundledPackages without neverBundle when bundledPackages is set but externals are not", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			bundledPackages: ["@commitlint/types"],
			build,
		});
		// JS pass: no deps at all.
		expect(captured[0]?.deps).toBeUndefined();
		// dts pass: skipNodeModulesBundle + dts.alwaysBundle present, neverBundle absent.
		expect((captured[1]?.deps as { onlyBundle?: unknown })?.onlyBundle).toBeUndefined();
		expect((captured[1]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(true);
		expect((captured[1]?.deps as { dts?: { alwaysBundle?: unknown } })?.dts?.alwaysBundle).toEqual([
			"@commitlint/types",
		]);
		expect((captured[1]?.deps as { neverBundle?: unknown })?.neverBundle).toBeUndefined();
	});

	it("inlines all node_modules into BOTH passes when bundleNodeModules is set (dts posture tracks the JS pass)", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["typescript"],
			bundleNodeModules: true,
			build,
		});
		// [0] = JS pass: skipNodeModulesBundle false, neverBundle (externals) still present.
		expect((captured[0]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		expect((captured[0]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["typescript"]);
		// [1] = dts pass: must MATCH the JS posture so the declarations are self-contained
		// (rslib parity). skipNodeModulesBundle false inlines every node_modules type; no
		// dts.alwaysBundle because bundledPackages is not set.
		expect((captured[1]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		expect((captured[1]?.deps as { dts?: unknown })?.dts).toBeUndefined();
		expect((captured[1]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["typescript"]);
	});

	it("inlines all node_modules into the dts AND keeps dts.alwaysBundle when both bundleNodeModules and bundledPackages are set", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["typescript"],
			bundleNodeModules: true,
			bundledPackages: ["@commitlint/types"],
			build,
		});
		// JS pass unchanged: skipNodeModulesBundle false, no dts/onlyBundle inlining knobs.
		expect((captured[0]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		expect((captured[0]?.deps as { dts?: unknown })?.dts).toBeUndefined();
		// dts pass: bundleNodeModules wins (skipNodeModulesBundle false inlines everything),
		// and dts.alwaysBundle is included as belt-and-suspenders since bundledPackages is set.
		expect((captured[1]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		expect((captured[1]?.deps as { dts?: { alwaysBundle?: unknown } })?.dts?.alwaysBundle).toEqual([
			"@commitlint/types",
		]);
		// onlyBundle is never used (strict-mode trap).
		expect((captured[1]?.deps as { onlyBundle?: unknown })?.onlyBundle).toBeUndefined();
	});

	it("sets deps.skipNodeModulesBundle false on the JS pass even when no externals are configured", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			bundleNodeModules: true,
			build,
		});
		// JS pass: skipNodeModulesBundle false present, neverBundle absent (no externals).
		expect((captured[0]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		expect((captured[0]?.deps as { neverBundle?: unknown })?.neverBundle).toBeUndefined();
	});

	it("leaves the JS pass deps unchanged when bundleNodeModules is absent or false", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["typescript"],
			build,
		});
		// JS pass: only neverBundle, no skipNodeModulesBundle key.
		expect((captured[0]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["typescript"]);
		expect(captured[0]?.deps as Record<string, unknown>).not.toHaveProperty("skipNodeModulesBundle");
	});

	it("turns the JS pass unbundle OFF when bundleNodeModules is set (self-contained esm+cjs)", async () => {
		// Regression test for the packed-esm defect: a per-module (preserveModules) JS pass
		// writes every inlined node_modules dependency it bundles to its OWN sibling file,
		// mirroring its node_modules/... path — which `npm pack` strips, so the esm entry
		// throws `Cannot find module` once packed and installed. bundleNodeModules already
		// promises a self-contained artifact (its own TSDoc says so); the JS pass must
		// actually bundle (not preserve modules) to keep that promise for BOTH esm and cjs.
		const captured: Array<{ unbundle?: unknown; dts?: unknown }> = [];
		const build = (async (cfg: { unbundle?: unknown; dts?: unknown }) => {
			captured.push({ unbundle: cfg.unbundle, dts: cfg.dts });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			format: ["esm", "cjs"],
			bundleNodeModules: true,
			build,
		});
		// [0] = JS pass (dts:false): unbundle must be false so both esm and cjs bundle whole.
		expect(captured[0]?.dts).toBe(false);
		expect(captured[0]?.unbundle).toBe(false);
		// [1] = dts pass: already unbundle:false regardless — unaffected, still bundled.
		expect(captured[1]?.unbundle).toBe(false);
	});

	it("leaves the JS pass unbundle ON when bundleNodeModules is absent (default per-module layout)", async () => {
		const captured: Array<{ unbundle?: unknown; dts?: unknown }> = [];
		const build = (async (cfg: { unbundle?: unknown; dts?: unknown }) => {
			captured.push({ unbundle: cfg.unbundle, dts: cfg.dts });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build,
		});
		expect(captured[0]?.dts).toBe(false);
		expect(captured[0]?.unbundle).toBe(true);
	});

	it("keeps the leaf dts pass deps byte-identical (only neverBundle) when neither bundle flag is set", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["effect"],
			build,
		});
		// dts pass (the four-leaves else-branch): neverBundle ONLY — no skipNodeModulesBundle,
		// no dts.alwaysBundle, no onlyBundle. This guards against regressing the leaves.
		expect(captured[1]?.deps).toEqual({ neverBundle: ["effect"] });
	});

	it("emits no deps at all on either pass when no externals and no bundle flags are set", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build,
		});
		expect(captured[0]?.deps).toBeUndefined();
		expect(captured[1]?.deps).toBeUndefined();
	});

	it("emits no deps at all on either pass when externals is an explicit empty array and no bundle flags are set", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			// Explicit empty array (the runBuild default). An empty array is truthy, so a
			// naive truthy guard would emit a spurious empty `deps: {}` on both passes.
			externals: [],
			build,
		});
		expect(captured[0]?.deps).toBeUndefined();
		expect(captured[1]?.deps).toBeUndefined();
	});

	it("unions dtsExternals into the dts pass neverBundle while the JS pass bundles them (bundleNodeModules)", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["typescript", "source-map-support"],
			bundleNodeModules: true,
			bundledPackages: ["@commitlint/types"],
			dtsExternals: ["effect", "@effect/platform"],
			build,
		});
		// JS pass: still force-bundles node_modules; neverBundle is the externals ONLY,
		// NOT the dtsExternals (the JS pass bundles effect for the self-contained runtime).
		expect((captured[0]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["typescript", "source-map-support"]);
		expect((captured[0]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		// dts pass: neverBundle is the UNION of externals + dtsExternals, so effect stays an
		// external import reference in the .d.ts while every other node_modules type inlines.
		expect((captured[1]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual([
			"typescript",
			"source-map-support",
			"effect",
			"@effect/platform",
		]);
		expect((captured[1]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		expect((captured[1]?.deps as { dts?: { alwaysBundle?: unknown } })?.dts?.alwaysBundle).toEqual([
			"@commitlint/types",
		]);
	});

	it("unions dtsExternals into the dts pass neverBundle with no externals configured", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			bundleNodeModules: true,
			dtsExternals: ["effect"],
			build,
		});
		// JS pass: no neverBundle (no externals), still force-bundles everything.
		expect((captured[0]?.deps as { neverBundle?: unknown })?.neverBundle).toBeUndefined();
		expect((captured[0]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		// dts pass: neverBundle is just the dtsExternals.
		expect((captured[1]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["effect"]);
		expect((captured[1]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
	});

	it("unions dtsExternals into the dts pass neverBundle in the bundledPackages-only branch", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["typescript"],
			bundledPackages: ["@commitlint/types"],
			dtsExternals: ["effect"],
			build,
		});
		// JS pass: neverBundle is externals only (no dtsExternals, no bundle flag here).
		expect((captured[0]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["typescript"]);
		// dts pass: neverBundle is the union; skipNodeModulesBundle true + alwaysBundle preserved.
		expect((captured[1]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["typescript", "effect"]);
		expect((captured[1]?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(true);
		expect((captured[1]?.deps as { dts?: { alwaysBundle?: unknown } })?.dts?.alwaysBundle).toEqual([
			"@commitlint/types",
		]);
	});

	it("builds a base partition plus an override partition with per-partition format/deps", async () => {
		const calls: Array<{ entry: unknown; format: unknown; clean: unknown; deps?: unknown; hasManifest: boolean }> = [];
		const build = (async (cfg: {
			entry: unknown;
			format: unknown;
			clean: unknown;
			deps?: unknown;
			plugins?: Array<{ name?: string }>;
		}) => {
			calls.push({
				entry: cfg.entry,
				format: cfg.format,
				clean: cfg.clean,
				deps: cfg.deps,
				hasManifest: (cfg.plugins ?? []).some((p) => p.name === "savvy:emit-manifest"),
			});
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { commitlint: "src/commitlint/index.ts" }, // BASE entries only (overrides removed upstream)
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			format: ["esm"],
			overrides: [
				{
					entry: { "changesets-markdownlint": "src/changesets/markdownlint.ts" },
					format: ["esm", "cjs"],
					bundle: ["@savvy-web/silk-effects"],
				},
			],
			build,
		});
		// Order: base JS (clean:true), base dts (clean:false), override JS (clean:false), override dts (clean:false).
		expect(calls[0]?.clean).toBe(true);
		expect(calls[0]?.entry).toEqual({ commitlint: "src/commitlint/index.ts" });
		expect(calls[0]?.format).toEqual(["esm"]);
		// every later pass is clean:false (never wipes the base output)
		expect(calls.slice(1).every((c) => c.clean === false)).toBe(true);
		// an override JS pass carries the override entry, dual format, and alwaysBundle
		const overrideJs = calls.find(
			(c) =>
				JSON.stringify(c.entry) === JSON.stringify({ "changesets-markdownlint": "src/changesets/markdownlint.ts" }) &&
				Array.isArray(c.format) &&
				(c.format as string[]).includes("cjs"),
		);
		expect(overrideJs).toBeDefined();
		expect((overrideJs?.deps as { alwaysBundle?: unknown })?.alwaysBundle).toEqual(["@savvy-web/silk-effects"]);
		// manifest is emitted exactly once (base partition's JS pass only)
		expect(calls.filter((c) => c.hasManifest).length).toBe(1);
		expect(calls[0]?.hasManifest).toBe(true);
	});

	it("threads a user define into the build() define alongside the auto-version", async () => {
		const defines: Array<Record<string, string>> = [];
		const fakeBuild = vi.fn(async (cfg: { define?: Record<string, string> }) => {
			if (cfg.define) defines.push(cfg.define);
			return [];
		});
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "2.0.0",
			entry: { index: "./src/index.ts" },
			tsconfigPath: "/tmp/t.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			define: { "process.env.FLAG": JSON.stringify("on") },
			build: fakeBuild as never,
		});
		// Both passes (JS + dts) receive the merged define.
		expect(defines.length).toBe(2);
		for (const d of defines) {
			expect(d["process.env.FLAG"]).toBe(JSON.stringify("on"));
			expect(d["process.env.__PACKAGE_VERSION__"]).toBe(JSON.stringify("2.0.0"));
		}
	});

	it("unions dtsExternals into the dts pass neverBundle in the plain branch (no bundle flags)", async () => {
		const captured: Array<{ deps?: unknown }> = [];
		const build = (async (cfg: { deps?: unknown }) => {
			captured.push({ deps: cfg.deps });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			externals: ["typescript"],
			dtsExternals: ["effect"],
			build,
		});
		// JS pass: externals only.
		expect((captured[0]?.deps as { neverBundle?: unknown })?.neverBundle).toEqual(["typescript"]);
		// dts pass: union, nothing else (plain leaf branch).
		expect(captured[1]?.deps).toEqual({ neverBundle: ["typescript", "effect"] });
	});

	it("emits one extra bundled, no-dts, no-manifest pass per loose file, after the base passes", async () => {
		const calls: Array<{
			entry: unknown;
			format: unknown;
			fixedExtension: unknown;
			unbundle: unknown;
			clean: unknown;
			dts: unknown;
			outDir: string;
			hasManifest: boolean;
			deps?: unknown;
		}> = [];
		const build = (async (cfg: {
			entry: unknown;
			format: unknown;
			fixedExtension: unknown;
			unbundle: unknown;
			clean: unknown;
			dts: unknown;
			outDir: string;
			plugins?: Array<{ name?: string }>;
			deps?: unknown;
		}) => {
			calls.push({
				entry: cfg.entry,
				format: cfg.format,
				fixedExtension: cfg.fixedExtension,
				unbundle: cfg.unbundle,
				clean: cfg.clean,
				dts: cfg.dts,
				outDir: cfg.outDir,
				hasManifest: (cfg.plugins ?? []).some((p) => p.name === "savvy:emit-manifest"),
				deps: cfg.deps,
			});
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			bundleNodeModules: true,
			looseFiles: [
				{
					outFile: "pnpmfile.mjs",
					entryName: "pnpmfile",
					source: "./src/pnpmfile.ts",
					format: "esm",
					fixedExtension: true,
				},
				{
					outFile: "pnpmfile.cjs",
					entryName: "pnpmfile",
					source: "./src/pnpmfile.ts",
					format: "cjs",
					fixedExtension: true,
				},
			],
			build,
		});
		// base JS + base dts (2) + one pass per loose file (2) = 4 calls.
		expect(calls.length).toBe(4);
		const loose = calls.slice(2);
		// ESM loose file: single entry, bundled, fixed extension, no dts, no manifest, clean:false.
		const mjs = loose.find((c) => Array.isArray(c.format) && (c.format as string[])[0] === "esm");
		expect(mjs?.entry).toEqual({ pnpmfile: "./src/pnpmfile.ts" });
		expect(mjs?.format).toEqual(["esm"]);
		expect(mjs?.fixedExtension).toBe(true);
		expect(mjs?.unbundle).toBe(false);
		expect(mjs?.dts).toBe(false);
		expect(mjs?.clean).toBe(false);
		expect(mjs?.hasManifest).toBe(false);
		expect(mjs?.outDir).toBe("/abs/pkg/dist/dev/pkg");
		// bundleNodeModules posture is inherited so the loose file is self-contained.
		expect((mjs?.deps as { skipNodeModulesBundle?: unknown })?.skipNodeModulesBundle).toBe(false);
		// CJS loose file present with cjs format.
		const cjs = loose.find((c) => Array.isArray(c.format) && (c.format as string[])[0] === "cjs");
		expect(cjs?.format).toEqual(["cjs"]);
	});

	it("attaches the cjs interop plugins to a cjs loose file but not an esm one", async () => {
		const passes: Array<{ format: string; plugins: string[] }> = [];
		const build = (async (cfg: {
			format: string[];
			dts: unknown;
			unbundle: unknown;
			plugins?: Array<{ name?: string }>;
		}) => {
			// Capture ONLY the loose-file passes. They are uniquely identified by unbundle:false
			// (bundled) AND dts:false: the base JS pass is unbundle:true, and the dts pass has
			// dts !== false. Filtering on dts:false alone would also match the base ESM JS pass
			// (deriveTargetGroupOptions emits it with dts:false + format:["esm"]), so `esm` would
			// resolve to the base pass and the esm assertion would have a blind spot.
			if (cfg.unbundle === false && cfg.dts === false && Array.isArray(cfg.format) && cfg.format.length === 1) {
				passes.push({ format: cfg.format[0] as string, plugins: (cfg.plugins ?? []).map((p) => p.name ?? "") });
			}
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			looseFiles: [
				{
					outFile: "pnpmfile.mjs",
					entryName: "pnpmfile",
					source: "./src/pnpmfile.ts",
					format: "esm",
					fixedExtension: true,
				},
				{
					outFile: "pnpmfile.cjs",
					entryName: "pnpmfile",
					source: "./src/pnpmfile.ts",
					format: "cjs",
					fixedExtension: true,
				},
			],
			build,
		});
		// Exactly the two loose-file passes were captured (the base JS/dts passes are excluded),
		// so `esm` below is genuinely the ESM loose-file pass, not the base ESM JS pass.
		expect(passes.length).toBe(2);
		const esm = passes.find((p) => p.format === "esm");
		const cjs = passes.find((p) => p.format === "cjs");
		expect(esm?.plugins).not.toContain("savvy:cjs-default-interop");
		expect(esm?.plugins).not.toContain("savvy:node-builtin-default-interop");
		expect(cjs?.plugins).toContain("savvy:cjs-default-interop");
		expect(cjs?.plugins).toContain("savvy:node-builtin-default-interop");
	});

	it("threads an override partition's platform + css into the JS pass only", async () => {
		const calls: Array<{ platform: unknown; css: unknown; dts: unknown; entry: Record<string, string> }> = [];
		const fakeBuild = vi.fn(
			async (cfg: { platform: unknown; css?: unknown; dts: unknown; entry: Record<string, string> }) => {
				calls.push({ platform: cfg.platform, css: cfg.css, dts: cfg.dts, entry: cfg.entry });
				return [];
			},
		);
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "./src/index.ts" }, // base (plugin) entry
			tsconfigPath: "/tmp/t.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			overrides: [
				{
					entry: { "runtime/index": "./src/runtime/index.tsx" },
					platform: "browser",
					css: { modules: { localsConvention: "camelCaseOnly", namedExport: false } },
					externals: ["react", "@theme"],
				},
			],
			build: fakeBuild as never,
		});

		// 1 group x (base JS, base dts, override JS, override dts) = 4 calls.
		expect(fakeBuild).toHaveBeenCalledTimes(4);
		const [baseJs, baseDts, ovJs, ovDts] = calls;

		// Base partition JS pass: node platform, no css.
		expect(baseJs?.platform).toBe("node");
		expect(baseJs?.css).toBeUndefined();

		// Base dts pass: stays node, NO css (types do not carry CSS config).
		expect(baseDts?.platform).toBe("node");
		expect(baseDts?.css).toBeUndefined();

		// Override JS pass: browser platform + css forwarded.
		expect(ovJs?.platform).toBe("browser");
		expect(ovJs?.css).toEqual({ modules: { localsConvention: "camelCaseOnly", namedExport: false } });
		expect(ovJs?.dts).toBe(false);

		// Override dts pass: stays node, NO css (types resolve via ambient declarations).
		expect(ovDts?.platform).toBe("node");
		expect(ovDts?.css).toBeUndefined();
	});

	it("routes an override partition with outSubdir into a nested outDir (both passes)", async () => {
		const calls: Array<{ outDir: string; dts: unknown }> = [];
		const fakeBuild = vi.fn(async (cfg: { outDir: string; dts: unknown }) => {
			calls.push({ outDir: cfg.outDir, dts: cfg.dts });
			return [];
		});
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "./src/index.ts" },
			tsconfigPath: "/tmp/t.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			overrides: [
				{
					entry: { index: "./src/runtime/index.tsx" },
					outSubdir: "runtime",
					platform: "browser",
					css: { modules: { localsConvention: "camelCaseOnly", namedExport: false }, inject: true },
					externals: ["react", "@theme"],
				},
			],
			build: fakeBuild as never,
		});

		// base JS, base dts, runtime JS, runtime dts = 4 calls.
		expect(fakeBuild).toHaveBeenCalledTimes(4);
		const [baseJs, baseDts, rtJs, rtDts] = calls;
		expect(baseJs.outDir).toBe("/abs/pkg/dist/dev/pkg");
		expect(baseDts.outDir).toBe("/abs/pkg/dist/dev/pkg");
		expect(rtJs.outDir).toBe("/abs/pkg/dist/dev/pkg/runtime");
		expect(rtJs.dts).toBe(false);
		expect(rtDts.outDir).toBe("/abs/pkg/dist/dev/pkg/runtime");
		expect(rtDts.dts).toEqual({ tsconfig: "/tmp/t.json", emitDtsOnly: true, generator: "tsc" });
	});

	it("skips the dts pass when all entries are bin/ (empty dts entry after bin filter)", async () => {
		// A partition whose only entry is a bin/ executable gets no .d.ts. deriveDtsPassOptions
		// strips all bin/-prefixed keys, leaving an empty entry map. The guard in buildTargetGroups
		// skips the dts build() call so tsdown never receives "No input files".
		const calls: Array<{ dts: unknown }> = [];
		const fakeBuild = vi.fn(async (cfg: { dts: unknown }) => {
			calls.push({ dts: cfg.dts });
			return [];
		});
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { "bin/cli": "./src/bin/cli.ts" },
			tsconfigPath: "/tmp/t.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			build: fakeBuild as never,
		});
		// Only the JS pass runs (dts:false). No dts build() call.
		expect(calls.length).toBe(1);
		expect(calls[0]?.dts).toBe(false);
	});

	it("runs a third per-module declarations pass into declarations/ when emitDeclarations is set", async () => {
		const calls: Array<Record<string, unknown>> = [];
		const build = async (cfg: Record<string, unknown>) => {
			calls.push(cfg);
		};
		await buildTargetGroups({
			cwd: "/repo/pkg",
			version: "1.0.0",
			entry: { index: "/repo/pkg/src/index.ts" },
			tsconfigPath: "/tmp/tsconfig.json",
			groups: [{ id: "npm", name: "pkg" }],
			devManifest: "preserve",
			emitDeclarations: true,
			build,
		});
		const decl = calls.find((c) => c.unbundle === true && String(c.outDir).endsWith("/dist/prod/npm/declarations"));
		expect(decl).toBeDefined();
		expect(decl?.dts).toEqual({ tsconfig: "/tmp/tsconfig.json", emitDtsOnly: true, generator: "tsc" });
		expect(decl?.clean).toBe(true);
	});

	it("declarations pass is best-effort: a failure does not abort the build and is recorded", async () => {
		const collector = new BuildCollector();
		const build = async (cfg: Record<string, unknown>) => {
			// Only the per-module declarations pass throws; the published JS + dts passes succeed.
			if (String(cfg.outDir).endsWith("/declarations")) throw new Error("decl boom");
		};
		await expect(
			buildTargetGroups({
				cwd: "/repo/pkg",
				version: "1.0.0",
				entry: { index: "/repo/pkg/src/index.ts" },
				tsconfigPath: "/tmp/tsconfig.json",
				groups: [{ id: "npm", name: "pkg" }],
				devManifest: "preserve",
				emitDeclarations: true,
				build,
				collector,
			}),
		).resolves.toBeUndefined();
		// pkg/ (JS+dts) still emitted; only the diagnostics-input pass failed, surfaced as a warning.
		expect(JSON.stringify(collector.snapshot("pkg"))).toContain("Could not emit per-module declarations");
	});

	it("does NOT run a declarations pass when emitDeclarations is absent (byte-identical default)", async () => {
		const calls: Array<Record<string, unknown>> = [];
		const build = async (cfg: Record<string, unknown>) => {
			calls.push(cfg);
		};
		await buildTargetGroups({
			cwd: "/repo/pkg",
			version: "1.0.0",
			entry: { index: "/repo/pkg/src/index.ts" },
			tsconfigPath: "/tmp/tsconfig.json",
			groups: [{ id: "npm", name: "pkg" }],
			devManifest: "preserve",
			build,
		});
		expect(calls.some((c) => String(c.outDir).endsWith("/declarations"))).toBe(false);
	});

	it("does NOT run a declarations pass for a dev group even when emitDeclarations is set (prod-only)", async () => {
		const calls: Array<Record<string, unknown>> = [];
		const build = async (cfg: Record<string, unknown>) => {
			calls.push(cfg);
		};
		await buildTargetGroups({
			cwd: "/repo/pkg",
			version: "1.0.0",
			entry: { index: "/repo/pkg/src/index.ts" },
			tsconfigPath: "/tmp/tsconfig.json",
			groups: [{ id: "dev", name: "pkg" }],
			devManifest: "preserve",
			emitDeclarations: true,
			build,
		});
		expect(calls.some((c) => String(c.outDir).endsWith("/declarations"))).toBe(false);
	});

	it("omits the types condition from the emitted manifest when emitDts is false", async () => {
		// issue #198: the manifest's exports must not point at a .d.ts that the (now-skipped) dts
		// pass never wrote.
		const dir = await mkdtemp(join(tmpdir(), "btg-emitdts-"));
		await writeFile(
			join(dir, "package.json"),
			JSON.stringify({ name: "base", version: "1.0.0", exports: { ".": "./src/index.ts" } }),
		);
		const captureBuild = (manifests: Array<Record<string, unknown>>) =>
			(async (cfg: { plugins: Array<{ name: string; generateBundle?: () => Promise<void> }> }) => {
				const emit = cfg.plugins.find((p) => p.name === "savvy:emit-manifest");
				await emit?.generateBundle?.call({
					emitFile(file: { fileName: string; source: string }) {
						if (file.fileName === "package.json") manifests.push(JSON.parse(file.source));
					},
				});
			}) as never;

		const manifests: Array<Record<string, unknown>> = [];
		await buildTargetGroups({
			cwd: dir,
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: join(dir, "tsconfig.json"),
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			emitDts: false,
			build: captureBuild(manifests),
		});
		const exportsOut = manifests[0]?.exports as Record<string, unknown>;
		expect(exportsOut["."]).toEqual({ import: "./index.js", default: "./index.js" });
	}, 30_000);

	it("skips both the dts pass and the declarations pass when emitDts is false, while the JS pass still emits", async () => {
		// issue #198: emitDts:false must drop BOTH the per-entry bundled dts pass AND the prod
		// per-module declarations pass (no TypeScript compiler load), while the JS pass is unaffected.
		const calls: Array<{ kind: "js" | "dts" | "declarations"; dts: unknown }> = [];
		const fakeBuild = vi.fn(async (cfg: { outDir: string; dts: unknown }) => {
			calls.push({
				kind: String(cfg.outDir).endsWith("/declarations") ? "declarations" : cfg.dts === false ? "js" : "dts",
				dts: cfg.dts,
			});
			return [];
		});
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "./src/index.ts" },
			tsconfigPath: "/tmp/t.json",
			groups: [{ id: "npm", name: "base" }],
			devManifest: "preserve",
			emitDeclarations: true,
			emitDts: false,
			build: fakeBuild as never,
		});
		// Only the JS pass ran — no dts build() call, no declarations build() call.
		expect(calls).toEqual([{ kind: "js", dts: false }]);
	});

	it("globs the whole source subtree for an outSubdir partition's JS pass, keeps the barrel for dts", async () => {
		const calls: Array<{ entry: unknown; dts: unknown }> = [];
		const fakeBuild = vi.fn(async (cfg: { entry: unknown; dts: unknown }) => {
			calls.push({ entry: cfg.entry, dts: cfg.dts });
			return [];
		});
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "./src/index.ts" },
			tsconfigPath: "/tmp/t.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			overrides: [
				{
					entry: { index: "./src/runtime/index.tsx" },
					outSubdir: "runtime",
					platform: "browser",
					externals: ["react"],
				},
			],
			build: fakeBuild as never,
		});

		// base JS, base dts, runtime JS, runtime dts = 4 calls.
		expect(fakeBuild).toHaveBeenCalledTimes(4);
		const [, , rtJs, rtDts] = calls;
		// JS pass: a glob over the barrel's source dir so the WHOLE bundleless subtree emits
		// (RSPress references some files only by path via globalUIComponents/resolve.alias), with
		// test/declaration files excluded.
		expect(rtJs.entry).toEqual([
			"./src/runtime/**/*.{ts,tsx,mts,cts}",
			"!./src/runtime/**/*.{test,spec}.{ts,tsx,mts,cts}",
			"!./src/runtime/**/*.d.{ts,cts,mts}",
		]);
		expect(rtJs.dts).toBe(false);
		// dts pass: stays the single named barrel entry so it rolls up one bundled index.d.ts.
		expect(rtDts.entry).toEqual({ index: "./src/runtime/index.tsx" });
	});
});

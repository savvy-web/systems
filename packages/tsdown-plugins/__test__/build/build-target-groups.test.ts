// packages/tsdown-plugins/__test__/build/build-target-groups.test.ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildTargetGroups } from "../../src/build/build-target-groups.js";

describe("buildTargetGroups", () => {
	it("runs a JS pass + a dts pass per group (two passes to the same outDir)", async () => {
		const calls: Array<{
			outDir: string;
			plugins: number;
			hasManifest: boolean;
			dts: unknown;
			unbundle: unknown;
			clean: unknown;
			inputOptions: { jsx?: unknown } | undefined;
		}> = [];
		const fakeBuild = vi.fn(
			async (cfg: {
				outDir: string;
				plugins: Array<{ name?: string }>;
				dts: unknown;
				unbundle: unknown;
				clean: unknown;
				inputOptions?: { jsx?: unknown };
			}) => {
				calls.push({
					outDir: cfg.outDir,
					plugins: cfg.plugins.length,
					hasManifest: cfg.plugins.some((p) => p.name === "savvy:emit-manifest"),
					dts: cfg.dts,
					unbundle: cfg.unbundle,
					clean: cfg.clean,
					inputOptions: cfg.inputOptions,
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
		expect(devDts.dts).toEqual({ tsconfig: "/tmp/t.json", emitDtsOnly: true });
		expect(devDts.unbundle).toBe(false);
		expect(devDts.clean).toBe(false);

		expect(devJs.inputOptions?.jsx).toBeUndefined(); // no jsx configured -> inputOptions omitted
	});

	it("builds once per group spec, threading the spec's name into the manifest pipeline", async () => {
		const dir = await mkdtemp(join(tmpdir(), "btg-"));
		await writeFile(join(dir, "package.json"), JSON.stringify({ name: "base", version: "1.0.0" }));

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

		// Two passes per group share an outDir, so dedup before comparing.
		expect([...new Set(calls.map((c) => c.outDir))].sort()).toEqual([
			join(dir, "dist/prod/github/pkg"),
			join(dir, "dist/prod/npm/pkg"),
		]);
		// The manifest transform fires once per group (JS pass only), not on the dts pass.
		expect(seenNames.sort()).toEqual(["@scope/base", "base"]);
	}, 30_000); // real fs (mkdtemp + manifest read) can starve past the 5s default under full-suite load

	it("passes jsx through to the tsdown build inputOptions when configured", async () => {
		const captured: Array<{ inputOptions: { jsx?: unknown } | undefined }> = [];
		const build = (async (cfg: { inputOptions?: { jsx?: unknown } }) => {
			captured.push({ inputOptions: cfg.inputOptions });
		}) as never;
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			groups: [{ id: "dev", name: "base" }],
			devManifest: "preserve",
			jsx: { runtime: "automatic", importSource: "react" },
			build,
		});
		expect(captured[0]?.inputOptions?.jsx).toEqual({ runtime: "automatic", importSource: "react" });
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
});

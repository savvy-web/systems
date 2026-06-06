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
});

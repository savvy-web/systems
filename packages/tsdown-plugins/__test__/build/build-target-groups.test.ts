// packages/tsdown-plugins/__test__/build/build-target-groups.test.ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildTargetGroups } from "../../src/build/build-target-groups.js";

describe("buildTargetGroups", () => {
	it("calls the builder once per group with the derived outDir + emitManifest plugin", async () => {
		const calls: Array<{ outDir: string; plugins: number }> = [];
		const fakeBuild = vi.fn(async (cfg: { outDir: string; plugins: unknown[] }) => {
			calls.push({ outDir: cfg.outDir, plugins: cfg.plugins.length });
			return [];
		});
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
		expect(fakeBuild).toHaveBeenCalledTimes(2);
		expect(calls[0].outDir).toBe("/abs/pkg/dist/dev/pkg");
		expect(calls[1].outDir).toBe("/abs/pkg/dist/prod/npm/pkg");
		expect(calls[0].plugins).toBeGreaterThanOrEqual(1); // emitManifest present
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

		expect(calls.map((c) => c.outDir).sort()).toEqual([
			join(dir, "dist/prod/github/pkg"),
			join(dir, "dist/prod/npm/pkg"),
		]);
		expect(seenNames.sort()).toEqual(["@scope/base", "base"]);
	});
});

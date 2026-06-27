// packages/tsdown-plugins/__test__/integration/ambient-dts.int.test.ts

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build as tsdownBuild } from "tsdown";
import { describe, expect, it } from "vitest";
import type { TsdownBuild } from "../../src/build/build-target-groups.js";
import { buildTargetGroups } from "../../src/build/build-target-groups.js";
import { copyAmbientDts } from "../../src/build/sync-public.js";
import { extractAmbientDts } from "../../src/entry/ambient-dts.js";

const silentBuild: TsdownBuild = (config) => (tsdownBuild as unknown as TsdownBuild)({ ...config, logLevel: "silent" });

describe("ambient .d.ts integration", () => {
	it("emits the file at the export-key path and points the manifest at it", async () => {
		const dir = await mkdtemp(join(tmpdir(), "ambient-int-"));
		const srcDir = join(dir, "src/long/path");
		await mkdir(srcDir, { recursive: true });
		const pkg = {
			name: "fixture",
			version: "1.0.0",
			type: "module",
			exports: {
				".": "./src/index.ts",
				"./virtual": { types: "./src/long/path/input-file.d.ts" },
				"./package.json": "./package.json",
			},
		};
		await writeFile(join(dir, "package.json"), JSON.stringify(pkg));
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { strict: true, moduleResolution: "bundler", module: "ESNext", target: "ESNext" },
			}),
		);
		await writeFile(join(dir, "src/index.ts"), `export const main = 1;\n`);
		await writeFile(
			join(srcDir, "input-file.d.ts"),
			`declare module "fixture/virtual/x" {\n  export const x: number;\n}\n`,
		);

		await buildTargetGroups({
			build: silentBuild,
			cwd: dir,
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: join(dir, "tsconfig.json"),
			groups: [{ id: "dev", name: "fixture" }],
			devManifest: "preserve",
		});
		// runBuild does this copy step after the build; reproduce it here.
		const ambient = extractAmbientDts(pkg, {});
		copyAmbientDts({ ambient, srcCwd: dir, outDir: join(dir, "dist/dev/pkg") });

		const pkgDir = join(dir, "dist/dev/pkg");
		expect(existsSync(join(pkgDir, "virtual.d.ts"))).toBe(true);
		expect(await readFile(join(pkgDir, "virtual.d.ts"), "utf-8")).toContain(`declare module "fixture/virtual/x"`);

		const manifest = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf-8")) as {
			exports: Record<string, unknown>;
		};
		expect(manifest.exports["./virtual"]).toEqual({ types: "./virtual.d.ts" });
		expect(manifest.exports["."]).toMatchObject({ types: "./index.d.ts", import: "./index.js" });
	}, 60_000);
});

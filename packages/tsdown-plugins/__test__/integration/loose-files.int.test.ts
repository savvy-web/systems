import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build as tsdownBuild } from "tsdown";
import { describe, expect, it } from "vitest";
import type { TsdownBuild } from "../../src/build/build-target-groups.js";
import { buildTargetGroups } from "../../src/build/build-target-groups.js";
import { normalizeLooseFiles } from "../../src/build/loose-files.js";

// Without a collector, buildTargetGroups leaves tsdown at its default logLevel, which prints the
// build reporter (entry table, "Build complete", file sizes) to stdout. Inject a build that forces
// logLevel:"silent" so the real build still runs but stays quiet. Mirrors the in-source muzzle.
const silentBuild: TsdownBuild = (config) => (tsdownBuild as unknown as TsdownBuild)({ ...config, logLevel: "silent" });

describe("looseFiles integration", () => {
	it("emits a self-contained loose file at its literal path alongside the main entry", async () => {
		const dir = await mkdtemp(join(tmpdir(), "loose-"));
		const srcDir = join(dir, "src");
		await mkdir(srcDir, { recursive: true });
		await writeFile(
			join(dir, "package.json"),
			JSON.stringify({ name: "fixture", version: "1.0.0", type: "module", exports: { ".": "./src/index.ts" } }),
		);
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { strict: true, moduleResolution: "bundler", module: "ESNext", target: "ESNext" },
			}),
		);
		await writeFile(join(srcDir, "greeting.ts"), `export const greeting = "hi-from-helper";\n`);
		await writeFile(join(srcDir, "index.ts"), `export const main = 1;\n`);
		await writeFile(
			join(srcDir, "pnpmfile.ts"),
			`import { greeting } from "./greeting.js";\nexport const hooks = { msg: greeting };\n`,
		);

		await buildTargetGroups({
			build: silentBuild,
			cwd: dir,
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: join(dir, "tsconfig.json"),
			groups: [{ id: "dev", name: "fixture" }],
			devManifest: "preserve",
			bundleNodeModules: true,
			looseFiles: normalizeLooseFiles({
				"pnpmfile.mjs": "./src/pnpmfile.ts",
				"pnpmfile.cjs": "./src/pnpmfile.ts",
			}),
		});

		const pkgDir = join(dir, "dist/dev/pkg");
		expect(existsSync(join(pkgDir, "pnpmfile.mjs"))).toBe(true);
		expect(existsSync(join(pkgDir, "pnpmfile.cjs"))).toBe(true);
		expect(existsSync(join(pkgDir, "index.js"))).toBe(true);

		const mjs = await readFile(join(pkgDir, "pnpmfile.mjs"), "utf-8");
		expect(mjs).toContain("hi-from-helper");
		expect(mjs).not.toMatch(/from\s+["']\.\/greeting/);

		const manifest = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf-8")) as {
			exports?: Record<string, unknown>;
		};
		expect(Object.keys(manifest.exports ?? {})).not.toContain("./pnpmfile.mjs");
		expect(Object.keys(manifest.exports ?? {})).not.toContain("./pnpmfile.cjs");
	}, 60_000);
});

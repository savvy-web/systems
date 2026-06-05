import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateMeta } from "../../src/meta/generate.js";

function scaffold(): { cwd: string; dtsDir: string; localPath: string } {
	const cwd = mkdtempSync(join(tmpdir(), "meta-"));
	writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "@scope/fixture", version: "1.0.0" }));
	writeFileSync(
		join(cwd, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				target: "ESNext",
				module: "ESNext",
				moduleResolution: "bundler",
				declaration: true,
				skipLibCheck: true,
				types: [],
			},
			include: [join(cwd, "**/*.d.ts")],
		}),
	);
	const dtsDir = join(cwd, "dist", "dev", "pkg");
	mkdirSync(dtsDir, { recursive: true });
	writeFileSync(join(dtsDir, "index.d.ts"), `export interface Public { y: number }\n`);
	const localPath = join(cwd, "models");
	mkdirSync(localPath, { recursive: true });
	return { cwd, dtsDir, localPath };
}

describe("generateMeta", () => {
	it("writes the meta bundle to outMetaDir and copies the api-model to localPaths", async () => {
		const { cwd, dtsDir, localPath } = scaffold();
		const outMetaDir = join(cwd, "dist", "prod", "npm", "meta");
		await generateMeta({
			cwd,
			packageName: "@scope/fixture",
			tsconfigPath: join(cwd, "tsconfig.json"),
			dtsDir,
			entries: { index: "index" },
			exportPaths: { index: "." },
			outMetaDir,
			localPaths: ["models"],
			tsdoc: { suppressWarnings: [], tagDefinitions: [] },
		});
		// release-asset bundle
		expect(existsSync(join(outMetaDir, "fixture.api.json"))).toBe(true);
		expect(existsSync(join(outMetaDir, "tsdoc-metadata.json"))).toBe(true);
		expect(existsSync(join(outMetaDir, "tsconfig.json"))).toBe(true);
		// localPaths copy
		expect(existsSync(join(localPath, "fixture.api.json"))).toBe(true);
		// tsdoc.json at package root (deterministic)
		expect(existsSync(join(cwd, "tsdoc.json"))).toBe(true);
	});
});

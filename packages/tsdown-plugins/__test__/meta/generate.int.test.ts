import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
	// The built pkg dir holds the FINAL transformed manifest (here marked so the test can prove
	// generateMeta copies this one, not the untransformed cwd/package.json source).
	writeFileSync(
		join(dtsDir, "package.json"),
		JSON.stringify({ name: "@scope/fixture", version: "1.0.0", private: false }),
	);
	const localPath = join(cwd, "models");
	mkdirSync(localPath, { recursive: true });
	return { cwd, dtsDir, localPath };
}

describe("generateMeta", () => {
	it("writes the virtual-TS-env trio to outMetaDir and copies it to localPaths", async () => {
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
		// release-asset bundle: the trio (api.json + package.json + tsconfig.json)
		expect(existsSync(join(outMetaDir, "fixture.api.json"))).toBe(true);
		expect(existsSync(join(outMetaDir, "package.json"))).toBe(true);
		expect(existsSync(join(outMetaDir, "tsconfig.json"))).toBe(true);
		// tsdoc-metadata.json is a published-package artifact -> pkg dir, NOT the meta bundle
		expect(existsSync(join(outMetaDir, "tsdoc-metadata.json"))).toBe(false);
		expect(existsSync(join(dtsDir, "tsdoc-metadata.json"))).toBe(true);

		// The bundled package.json is the FINAL/transformed one from the pkg dir.
		const bundledManifest = JSON.parse(readFileSync(join(outMetaDir, "package.json"), "utf-8")) as {
			private?: boolean;
		};
		expect(bundledManifest.private).toBe(false);

		// The bundled tsconfig is the portable, compilerOptions-only derived config.
		const bundledTsconfig = JSON.parse(readFileSync(join(outMetaDir, "tsconfig.json"), "utf-8")) as {
			$schema?: string;
			compilerOptions: Record<string, unknown>;
		};
		expect(bundledTsconfig.$schema).toBe("https://json.schemastore.org/tsconfig");
		expect(bundledTsconfig.compilerOptions.noEmit).toBe(true);
		expect(bundledTsconfig.compilerOptions.composite).toBe(false);
		expect(bundledTsconfig.compilerOptions).not.toHaveProperty("declaration");
		expect(bundledTsconfig).not.toHaveProperty("include");

		// localPaths copy: the trio, no tsdoc-metadata.json
		expect(existsSync(join(localPath, "fixture.api.json"))).toBe(true);
		expect(existsSync(join(localPath, "package.json"))).toBe(true);
		expect(existsSync(join(localPath, "tsconfig.json"))).toBe(true);
		expect(existsSync(join(localPath, "tsdoc-metadata.json"))).toBe(false);

		// tsdoc.json at package root (deterministic)
		expect(existsSync(join(cwd, "tsdoc.json"))).toBe(true);
	});
});

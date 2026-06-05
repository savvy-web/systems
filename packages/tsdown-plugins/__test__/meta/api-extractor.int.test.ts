import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runApiExtractor } from "../../src/meta/api-extractor.js";
import { writeTsdocConfig } from "../../src/meta/tsdoc-config.js";

function scaffold(): { dir: string; dtsDir: string } {
	const dir = mkdtempSync(join(tmpdir(), "ae-"));
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "@scope/fixture", version: "1.0.0", types: "./index.d.ts" }),
	);
	// resolved tsconfig with absolute paths (mirrors writeResolvedTsconfig output shape)
	writeFileSync(
		join(dir, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				target: "ESNext",
				module: "ESNext",
				moduleResolution: "bundler",
				declaration: true,
				skipLibCheck: true,
				types: [],
			},
			include: [join(dir, "**/*.d.ts")],
		}),
	);
	const dtsDir = join(dir, "dist");
	mkdirSync(dtsDir, { recursive: true });
	// a forgotten export (Hidden is referenced but not exported) to exercise suppression on its _base-like name
	writeFileSync(
		join(dtsDir, "index.d.ts"),
		`interface Hidden_base { x: number }\nexport interface Public extends Hidden_base { y: number }\n`,
	);
	return { dir, dtsDir };
}

describe("runApiExtractor", () => {
	it("produces a .api.json and suppresses ae-forgotten-export/_base", () => {
		const { dir, dtsDir } = scaffold();
		const tsdocConfigPath = writeTsdocConfig(dir, { suppressWarnings: [], tagDefinitions: [] });
		const apiJsonPath = join(dir, "out.api.json");
		runApiExtractor({
			cwd: dir,
			packageJsonPath: join(dir, "package.json"),
			entryDtsPath: join(dtsDir, "index.d.ts"),
			tsconfigPath: join(dir, "tsconfig.json"),
			tsdocConfigPath,
			apiJsonPath,
			tsdocMetadataPath: join(dir, "tsdoc-metadata.json"),
			suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
		});
		expect(existsSync(apiJsonPath)).toBe(true);
		const model = JSON.parse(readFileSync(apiJsonPath, "utf-8")) as { kind: string };
		expect(model.kind).toBe("Package");
	});
});

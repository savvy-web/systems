import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runApiExtractor } from "../../src/meta/api-extractor.js";
import { writeTsdocConfig } from "../../src/meta/tsdoc-config.js";

function scaffoldForgotten(): { dir: string; entryDtsPath: string; tsconfigPath: string; packageJsonPath: string } {
	const dir = mkdtempSync(join(tmpdir(), "ae-fe-"));
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "@scope/fixture", version: "1.0.0", types: "./index.d.ts" }),
	);
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
	// `Bar` is referenced by the exported `getBar` but not itself exported -> ae-forgotten-export.
	// `getBar` carries @public so ae-missing-release-tag does not also fire and mask the assertion.
	writeFileSync(
		join(dtsDir, "index.d.ts"),
		`interface Bar { bar: number }\n/** @public */\ndeclare function getBar(): Bar;\nexport { getBar };\n`,
	);
	return {
		dir,
		entryDtsPath: join(dtsDir, "index.d.ts"),
		tsconfigPath: join(dir, "tsconfig.json"),
		packageJsonPath: join(dir, "package.json"),
	};
}

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

	it("routes an unsuppressed ae-forgotten-export to onMessage as a warn diagnostic (non-CI)", () => {
		// api-extractor's default message routing is logLevel "none"; without the configObject `messages`
		// override these analyzer messages reach messageCallback already silenced and never surface. This
		// fixture has a genuine forgotten export, so onMessage must fire — as a warning outside CI, flagged
		// ciFatal so the formatter can nudge.
		const f = scaffoldForgotten();
		const tsdocConfigPath = writeTsdocConfig(f.dir, { suppressWarnings: [], tagDefinitions: [] });
		const messages: Array<{ level: string; code?: string | undefined; ciFatal?: boolean | undefined }> = [];
		runApiExtractor({
			cwd: f.dir,
			packageJsonPath: f.packageJsonPath,
			entryDtsPath: f.entryDtsPath,
			tsconfigPath: f.tsconfigPath,
			tsdocConfigPath,
			apiJsonPath: join(f.dir, "out.api.json"),
			suppressWarnings: [],
			onMessage: (e) => messages.push({ level: e.level, code: e.code, ciFatal: e.ciFatal }),
		});
		const forgotten = messages.find((m) => m.code === "ae-forgotten-export");
		expect(forgotten).toBeDefined();
		expect(forgotten?.level).toBe("warn");
		expect(forgotten?.ciFatal).toBe(true);
	});

	it("fails the build when ci=true and ae-forgotten-export is not suppressed", () => {
		const f = scaffoldForgotten();
		const tsdocConfigPath = writeTsdocConfig(f.dir, { suppressWarnings: [], tagDefinitions: [] });
		expect(() =>
			runApiExtractor({
				cwd: f.dir,
				packageJsonPath: f.packageJsonPath,
				entryDtsPath: f.entryDtsPath,
				tsconfigPath: f.tsconfigPath,
				tsdocConfigPath,
				apiJsonPath: join(f.dir, "out.api.json"),
				suppressWarnings: [],
				ci: true,
			}),
		).toThrow(/API Extractor/);
	});

	it("routes a suppressed ae-forgotten-export to onSuppressed and does not throw in ci", () => {
		const f = scaffoldForgotten();
		const tsdocConfigPath = writeTsdocConfig(f.dir, { suppressWarnings: [], tagDefinitions: [] });
		const suppressed: Array<{ code?: string | undefined; text: string }> = [];
		runApiExtractor({
			cwd: f.dir,
			packageJsonPath: f.packageJsonPath,
			entryDtsPath: f.entryDtsPath,
			tsconfigPath: f.tsconfigPath,
			tsdocConfigPath,
			apiJsonPath: join(f.dir, "out.api.json"),
			suppressWarnings: [{ messageId: "ae-forgotten-export" }],
			ci: true,
			onSuppressed: (e) => suppressed.push({ code: e.code, text: e.text }),
		});
		expect(suppressed.some((s) => s.code === "ae-forgotten-export")).toBe(true);
	});

	it("emitDocModel:false reports diagnostics but writes no .api.json", () => {
		const f = scaffoldForgotten();
		const tsdocConfigPath = writeTsdocConfig(f.dir, { suppressWarnings: [], tagDefinitions: [] });
		const apiJsonPath = join(f.dir, "should-not-exist.api.json");
		const seen: Array<string | undefined> = [];
		runApiExtractor({
			cwd: f.dir,
			packageJsonPath: f.packageJsonPath,
			entryDtsPath: f.entryDtsPath,
			tsconfigPath: f.tsconfigPath,
			tsdocConfigPath,
			apiJsonPath,
			suppressWarnings: [],
			emitDocModel: false,
			onMessage: (e) => seen.push(e.code),
		});
		expect(existsSync(apiJsonPath)).toBe(false);
		expect(seen).toContain("ae-forgotten-export");
	});
});

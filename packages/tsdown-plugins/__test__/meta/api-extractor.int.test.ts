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
			// Route the remaining (unsuppressed) ae-missing-release-tag warnings to a no-op so API
			// Extractor marks them handled and does not print them to the console; this test only
			// asserts on the emitted .api.json, not on diagnostic text.
			onMessage: () => {},
		});
		expect(existsSync(apiJsonPath)).toBe(true);
		const model = JSON.parse(readFileSync(apiJsonPath, "utf-8")) as { kind: string };
		expect(model.kind).toBe("Package");
	});

	it("includes forgotten exports in the emitted .api.json so the model stays reconstructable", () => {
		// rspress-plugin-api-extractor#56: a forgotten export (here `Bar`, referenced by `getBar` but not
		// exported) must be INCLUDED in the doc model, not dropped — otherwise downstream .d.ts
		// reconstruction loses the referenced type (the synthetic `*_base` of Effect class mixins is the
		// real-world offender). includeForgottenExports: true keeps the model complete.
		const f = scaffoldForgotten();
		const tsdocConfigPath = writeTsdocConfig(f.dir, { suppressWarnings: [], tagDefinitions: [] });
		const apiJsonPath = join(f.dir, "out.api.json");
		runApiExtractor({
			cwd: f.dir,
			packageJsonPath: f.packageJsonPath,
			entryDtsPath: f.entryDtsPath,
			tsconfigPath: f.tsconfigPath,
			tsdocConfigPath,
			apiJsonPath,
			suppressWarnings: [],
			onMessage: () => {},
		});
		const model = JSON.parse(readFileSync(apiJsonPath, "utf-8")) as { members?: unknown[] };
		const names: string[] = [];
		const walk = (node: unknown): void => {
			if (node === null || typeof node !== "object") return;
			const n = node as { name?: unknown; members?: unknown[] };
			if (typeof n.name === "string" && n.name.length > 0) names.push(n.name);
			if (Array.isArray(n.members)) for (const m of n.members) walk(m);
		};
		walk(model);
		expect(names).toContain("getBar");
		expect(names).toContain("Bar"); // the forgotten export, now retained in the model
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
				// Route the (CI-fatal) ae-forgotten-export diagnostic to a no-op so it is not printed to
				// the console. This only suppresses the message's own output via `handled`; the build still
				// fails on result.errorCount, so the throw assertion below is unaffected.
				onMessage: () => {},
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
			// Route the remaining (unsuppressed) ae-missing-release-tag on the forgotten `Bar` to a no-op so
			// API Extractor marks it handled and does not print it to the console; this test only asserts on
			// onSuppressed, not diagnostic text.
			onMessage: () => {},
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

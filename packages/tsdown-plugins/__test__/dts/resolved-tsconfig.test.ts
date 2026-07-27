// packages/tsdown-plugins/__test__/dts/resolved-tsconfig.test.ts

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildResolvedTsconfig, writeDtsEmitTsconfig } from "../../src/dts/resolved-tsconfig.js";

describe("buildResolvedTsconfig", () => {
	it("inherits the package's own compilerOptions", async () => {
		const dir = await mkdtemp(join(tmpdir(), "rtc-own-"));
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					target: "es2022",
					module: "nodenext",
					strict: true,
					verbatimModuleSyntax: true,
					types: ["node", "vitest"],
				},
			}),
		);
		const cfg = buildResolvedTsconfig({ cwd: dir });
		expect(cfg.compilerOptions.target).toBe("es2022");
		expect(cfg.compilerOptions.module).toBe("nodenext");
		expect(cfg.compilerOptions.strict).toBe(true);
		expect(cfg.compilerOptions.verbatimModuleSyntax).toBe(true);
		// `types` now comes from the resolved config, not a caller-supplied option.
		expect(cfg.compilerOptions.types).toEqual(["node", "vitest"]);
	});

	it("overlays the dts-pass deltas over whatever the package declares", async () => {
		const dir = await mkdtemp(join(tmpdir(), "rtc-overlay-"));
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					composite: true,
					incremental: true,
					declarationMap: false,
					tsBuildInfoFile: "dist/.tsbuildinfo.lib",
				},
			}),
		);
		const cfg = buildResolvedTsconfig({ cwd: dir });
		// Never skip emit on stale build info.
		expect(cfg.compilerOptions.composite).toBe(false);
		expect(cfg.compilerOptions.incremental).toBe(false);
		expect(cfg.compilerOptions.declarationMap).toBe(true);
		expect(cfg.compilerOptions.tsBuildInfoFile).toBeUndefined();
	});

	it("substitutes ${configDir} into absolute paths", async () => {
		const dir = await mkdtemp(join(tmpdir(), "rtc-configdir-"));
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					rootDir: "${configDir}",
					outDir: "${configDir}/dist",
					typeRoots: ["${configDir}/node_modules/@types", "${configDir}/types"],
				},
			}),
		);
		const cfg = buildResolvedTsconfig({ cwd: dir });
		expect(cfg.compilerOptions.rootDir).toBe(dir);
		expect(cfg.compilerOptions.outDir).toBe(join(dir, "dist"));
		expect((cfg.compilerOptions.typeRoots as string[]).every(isAbsolute)).toBe(true);
	});

	it("falls back to synthesized defaults when the package has no tsconfig.json", () => {
		// The e2e leaf fixtures build without one; absence must not throw.
		const cfg = buildResolvedTsconfig({ cwd: "/abs/pkg" });
		expect(cfg.compilerOptions.rootDir).toBe("/abs/pkg");
		expect(cfg.compilerOptions.types).toEqual(["node"]);
		expect(cfg.compilerOptions.declaration).toBe(true);
		expect(cfg.compilerOptions.composite).toBe(false);
		expect((cfg.compilerOptions.typeRoots as string[]).every(isAbsolute)).toBe(true);
	});

	it("emits absolute include/exclude entries and globs types as declarations", () => {
		const cfg = buildResolvedTsconfig({ cwd: "/abs/pkg" });
		expect((cfg.include as string[]).every(isAbsolute)).toBe(true);
		expect((cfg.exclude as string[]).every(isAbsolute)).toBe(true);
		expect(cfg.include).toContain("/abs/pkg/types/*.d.ts");
		// __test__ sources stay OUT of the declaration program even though the
		// package's own tsconfig includes them.
		expect((cfg.include as string[]).some((p) => p.includes("__test__"))).toBe(false);
	});

	it("forces declaration on and emitDeclarationOnly off even when the package disables them", async () => {
		// A consumer tsconfig with declaration:false + emitDeclarationOnly:true must not survive the
		// resolve: the dts pass's entire job is emitting declarations, and declarationMap-without-
		// declaration crashes TypeScript's emitter (Debug Failure in getSourceMappingURL).
		const dir = await mkdtemp(join(tmpdir(), "rtc-decl-off-"));
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					declaration: false,
					emitDeclarationOnly: true,
				},
			}),
		);
		const cfg = buildResolvedTsconfig({ cwd: dir });
		expect(cfg.compilerOptions.declaration).toBe(true);
		expect(cfg.compilerOptions.emitDeclarationOnly).toBe(false);
	});

	it("lets an explicit jsx override win over the resolved config", async () => {
		const dir = await mkdtemp(join(tmpdir(), "rtc-jsx-"));
		await writeFile(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "preserve" } }));
		const cfg = buildResolvedTsconfig({ cwd: dir, jsx: "react-jsx", jsxImportSource: "react" });
		expect(cfg.compilerOptions.jsx).toBe("react-jsx");
		expect(cfg.compilerOptions.jsxImportSource).toBe("react");
	});

	it("keeps the resolved jsx when no override is passed", async () => {
		const dir = await mkdtemp(join(tmpdir(), "rtc-jsx-none-"));
		await writeFile(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "preserve" } }));
		const cfg = buildResolvedTsconfig({ cwd: dir });
		expect(cfg.compilerOptions.jsx).toBe("preserve");
	});
});

describe("writeDtsEmitTsconfig", () => {
	it("writes a temp-dir wrapper that extends the base by absolute path and adds stableTypeOrdering", async () => {
		const dir = await mkdtemp(join(tmpdir(), "dtscfg-"));
		const base = join(dir, "tsconfig-bundle.json");
		const baseCfg = buildResolvedTsconfig({ cwd: dir });
		await writeFile(base, JSON.stringify(baseCfg, null, "\t"));

		const out = writeDtsEmitTsconfig(base);
		// A distinct file (the api-extractor tsconfig keeps its own path) written under the OS temp dir,
		// NOT next to the base — so an in-tree base tsconfig is never polluted with a sibling.
		expect(out).not.toBe(base);
		expect(out.startsWith(tmpdir())).toBe(true);

		const emitted = JSON.parse(await readFile(out, "utf-8")) as {
			extends: string;
			compilerOptions: Record<string, unknown>;
		};
		// Inherits the base via an ABSOLUTE extends (keeps the base's own relative paths resolving) and
		// adds only the flag that makes TS6 declaration emit order union/type members deterministically.
		expect(emitted.extends).toBe(base);
		expect(emitted.compilerOptions).toEqual({ stableTypeOrdering: true });
		// The base (api-extractor) tsconfig is NOT mutated — it must never carry the unknown flag.
		const stillBase = JSON.parse(await readFile(base, "utf-8")) as { compilerOptions: Record<string, unknown> };
		expect(stillBase.compilerOptions.stableTypeOrdering).toBeUndefined();
	});

	it("falls back to the original path when the base tsconfig does not exist", () => {
		// A synthetic path that was never written (the shape unit tests pass). Best-effort: return the
		// input unchanged rather than writing a stray file, so the dts pass keeps TS's default ordering.
		const missing = join(tmpdir(), "definitely-not-written-xyz.json");
		expect(writeDtsEmitTsconfig(missing)).toBe(missing);
	});
});

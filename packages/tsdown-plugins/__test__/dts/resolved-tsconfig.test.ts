// packages/tsdown-plugins/__test__/dts/resolved-tsconfig.test.ts

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildResolvedTsconfig, writeDtsEmitTsconfig } from "../../src/dts/resolved-tsconfig.js";

describe("buildResolvedTsconfig", () => {
	it("emits absolute rootDir/include/typeRoots and disables composite/incremental", () => {
		const cfg = buildResolvedTsconfig({ cwd: "/abs/pkg", types: ["node", "vitest"] });
		expect(isAbsolute(cfg.compilerOptions.rootDir as string)).toBe(true);
		expect(cfg.compilerOptions.composite).toBe(false);
		expect(cfg.compilerOptions.incremental).toBe(false);
		expect(cfg.compilerOptions.types).toEqual(["node", "vitest"]);
		expect((cfg.include as string[]).every(isAbsolute)).toBe(true);
		expect((cfg.compilerOptions.typeRoots as string[]).every(isAbsolute)).toBe(true);
	});

	it("defaults types to ['node'] when none forwarded", () => {
		expect(buildResolvedTsconfig({ cwd: "/abs/pkg" }).compilerOptions.types).toEqual(["node"]);
	});

	it("injects jsx and jsxImportSource into compilerOptions when provided", () => {
		const cfg = buildResolvedTsconfig({ cwd: "/abs/pkg", jsx: "react-jsx", jsxImportSource: "react" }) as {
			compilerOptions: { jsx?: string; jsxImportSource?: string };
		};
		expect(cfg.compilerOptions.jsx).toBe("react-jsx");
		expect(cfg.compilerOptions.jsxImportSource).toBe("react");
	});

	it("omits jsx keys when not provided", () => {
		const cfg = buildResolvedTsconfig({ cwd: "/abs/pkg" }) as { compilerOptions: { jsx?: string } };
		expect(cfg.compilerOptions.jsx).toBeUndefined();
	});
});

describe("writeDtsEmitTsconfig", () => {
	it("writes a temp-dir wrapper that extends the base by absolute path and adds stableTypeOrdering", async () => {
		const dir = await mkdtemp(join(tmpdir(), "dtscfg-"));
		const base = join(dir, "tsconfig-bundle.json");
		const baseCfg = buildResolvedTsconfig({ cwd: dir, types: ["node"] });
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

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePortableTsconfig } from "../../src/meta/tsconfig-resolver.js";

describe("resolvePortableTsconfig", () => {
	it("resolves this package's effective options (follows extends), portable", () => {
		const cwd = new URL("../../", import.meta.url).pathname;
		const result = resolvePortableTsconfig(cwd);
		expect(result.$schema).toBe("https://json.schemastore.org/tsconfig");
		// Full effective options inherited from @savvy-web/bundler/ecma.json.
		expect(result.compilerOptions.target).toBe("es2025");
		expect(result.compilerOptions.module).toBe("nodenext");
		expect(result.compilerOptions.moduleResolution).toBe("nodenext");
		expect(result.compilerOptions.strict).toBe(true);
		expect(result.compilerOptions.lib).toEqual(["esnext"]);
		// Forced virtual-env settings.
		expect(result.compilerOptions.composite).toBe(false);
		expect(result.compilerOptions.noEmit).toBe(true);
		// No machine-specific or emit/path keys leak through.
		const json = JSON.stringify(result);
		expect(json).not.toContain("/Users/");
		expect(result.compilerOptions).not.toHaveProperty("rootDir");
		expect(result.compilerOptions).not.toHaveProperty("outDir");
		expect(result.compilerOptions).not.toHaveProperty("declaration");
		expect(result).not.toHaveProperty("include");
	});

	it("falls back to the resolved config when the package has no own tsconfig.json", () => {
		const fallback = new URL("../../tsconfig.json", import.meta.url).pathname;
		const result = resolvePortableTsconfig("/no/such/dir/at/all", fallback);
		expect(result.$schema).toBe("https://json.schemastore.org/tsconfig");
		expect(result.compilerOptions.noEmit).toBe(true);
		expect(result.compilerOptions.composite).toBe(false);
	});

	it("returns a minimal portable config when neither an own nor a fallback tsconfig exists", () => {
		const result = resolvePortableTsconfig("/no/such/dir/at/all");
		expect(result).toEqual({
			$schema: "https://json.schemastore.org/tsconfig",
			compilerOptions: { composite: false, noEmit: true },
		});
	});

	it("re-adds `types` from the resolved config into the portable output", async () => {
		const dir = await mkdtemp(join(tmpdir(), "portable-types-"));
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({ compilerOptions: { target: "es2022", types: ["node", "vitest"] } }),
		);
		const result = resolvePortableTsconfig(dir);
		expect(result.compilerOptions.types).toEqual(["node", "vitest"]);
	});

	it("omits `types` from the portable output when the source declares none", async () => {
		const dir = await mkdtemp(join(tmpdir(), "portable-no-types-"));
		await writeFile(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "es2022" } }));
		const result = resolvePortableTsconfig(dir);
		expect(result.compilerOptions).not.toHaveProperty("types");
	});

	it("still drops `typeRoots` from the portable output even when the source declares it", async () => {
		const dir = await mkdtemp(join(tmpdir(), "portable-typeroots-"));
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					target: "es2022",
					types: ["node"],
					// biome-ignore lint/suspicious/noTemplateCurlyInString: TypeScript's own ${configDir} token, not a JS template
					typeRoots: ["${configDir}/node_modules/@types"],
				},
			}),
		);
		const result = resolvePortableTsconfig(dir);
		expect(result.compilerOptions).not.toHaveProperty("typeRoots");
	});
});

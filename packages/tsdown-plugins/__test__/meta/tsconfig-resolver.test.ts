import type { ParsedCommandLine } from "typescript";
import { JsxEmit, ModuleDetectionKind, ModuleKind, ModuleResolutionKind, NewLineKind, ScriptTarget } from "typescript";
import { describe, expect, it } from "vitest";
import { TsconfigResolver, resolvePortableTsconfig } from "../../src/meta/tsconfig-resolver.js";

function parsed(options: ParsedCommandLine["options"], raw?: unknown): ParsedCommandLine {
	return { options, fileNames: [], errors: [], ...(raw !== undefined ? { raw } : {}) };
}

describe("TsconfigResolver", () => {
	describe("static convertScriptTarget", () => {
		it("converts ES2022", () => {
			expect(TsconfigResolver.convertScriptTarget(ScriptTarget.ES2022)).toBe("es2022");
		});

		it("converts ES2023", () => {
			expect(TsconfigResolver.convertScriptTarget(ScriptTarget.ES2023)).toBe("es2023");
		});

		it("converts ESNext", () => {
			expect(TsconfigResolver.convertScriptTarget(ScriptTarget.ESNext)).toBe("esnext");
		});

		it("converts Latest to esnext", () => {
			expect(TsconfigResolver.convertScriptTarget(ScriptTarget.Latest)).toBe("esnext");
		});

		it("returns undefined for undefined input", () => {
			expect(TsconfigResolver.convertScriptTarget(undefined)).toBeUndefined();
		});

		it("handles all ES versions", () => {
			expect(TsconfigResolver.convertScriptTarget(ScriptTarget.ES5)).toBe("es5");
			expect(TsconfigResolver.convertScriptTarget(ScriptTarget.ES2015)).toBe("es2015");
			expect(TsconfigResolver.convertScriptTarget(ScriptTarget.ES2020)).toBe("es2020");
			expect(TsconfigResolver.convertScriptTarget(ScriptTarget.ES2024)).toBe("es2024");
		});

		it("falls back for unknown future targets", () => {
			expect(TsconfigResolver.convertScriptTarget(17 as ScriptTarget)).toBe("es17");
		});
	});

	describe("static convertModuleKind", () => {
		it("converts NodeNext", () => {
			expect(TsconfigResolver.convertModuleKind(ModuleKind.NodeNext)).toBe("nodenext");
		});

		it("converts ESNext", () => {
			expect(TsconfigResolver.convertModuleKind(ModuleKind.ESNext)).toBe("esnext");
		});

		it("converts CommonJS", () => {
			expect(TsconfigResolver.convertModuleKind(ModuleKind.CommonJS)).toBe("commonjs");
		});

		it("converts Preserve", () => {
			expect(TsconfigResolver.convertModuleKind(ModuleKind.Preserve)).toBe("preserve");
		});

		it("returns undefined for undefined input", () => {
			expect(TsconfigResolver.convertModuleKind(undefined)).toBeUndefined();
		});

		it("converts Node18 (enum value 101)", () => {
			expect(TsconfigResolver.convertModuleKind(101 as ModuleKind)).toBe("node18");
		});

		it("converts Node20 (enum value 102)", () => {
			expect(TsconfigResolver.convertModuleKind(102 as ModuleKind)).toBe("node20");
		});

		it("falls back for unknown future module kinds", () => {
			expect(TsconfigResolver.convertModuleKind(999 as ModuleKind)).toBe("999");
		});
	});

	describe("static convertModuleResolution", () => {
		it("converts NodeNext", () => {
			expect(TsconfigResolver.convertModuleResolution(ModuleResolutionKind.NodeNext)).toBe("nodenext");
		});

		it("converts Bundler", () => {
			expect(TsconfigResolver.convertModuleResolution(ModuleResolutionKind.Bundler)).toBe("bundler");
		});

		it("converts NodeJs to node10 (deprecated alias)", () => {
			expect(TsconfigResolver.convertModuleResolution(ModuleResolutionKind.NodeJs)).toBe("node10");
		});

		it("returns undefined for undefined input", () => {
			expect(TsconfigResolver.convertModuleResolution(undefined)).toBeUndefined();
		});

		it("falls back for unknown future resolution kinds", () => {
			expect(TsconfigResolver.convertModuleResolution(999 as ModuleResolutionKind)).toBe("999");
		});
	});

	describe("static convertJsxEmit", () => {
		it("converts react-jsx", () => {
			expect(TsconfigResolver.convertJsxEmit(JsxEmit.ReactJSX)).toBe("react-jsx");
		});

		it("converts preserve", () => {
			expect(TsconfigResolver.convertJsxEmit(JsxEmit.Preserve)).toBe("preserve");
		});

		it("converts react-jsxdev", () => {
			expect(TsconfigResolver.convertJsxEmit(JsxEmit.ReactJSXDev)).toBe("react-jsxdev");
		});

		it("converts none", () => {
			expect(TsconfigResolver.convertJsxEmit(JsxEmit.None)).toBe("none");
		});

		it("returns undefined for undefined input", () => {
			expect(TsconfigResolver.convertJsxEmit(undefined)).toBeUndefined();
		});

		it("falls back for unknown future jsx emit values", () => {
			expect(TsconfigResolver.convertJsxEmit(999 as JsxEmit)).toBe("999");
		});
	});

	describe("static convertModuleDetection", () => {
		it("converts auto", () => {
			expect(TsconfigResolver.convertModuleDetection(ModuleDetectionKind.Auto)).toBe("auto");
		});

		it("converts force", () => {
			expect(TsconfigResolver.convertModuleDetection(ModuleDetectionKind.Force)).toBe("force");
		});

		it("returns undefined for undefined input", () => {
			expect(TsconfigResolver.convertModuleDetection(undefined)).toBeUndefined();
		});
	});

	describe("static convertNewLine", () => {
		it("converts lf", () => {
			expect(TsconfigResolver.convertNewLine(NewLineKind.LineFeed)).toBe("lf");
		});

		it("converts crlf", () => {
			expect(TsconfigResolver.convertNewLine(NewLineKind.CarriageReturnLineFeed)).toBe("crlf");
		});

		it("returns undefined for undefined input", () => {
			expect(TsconfigResolver.convertNewLine(undefined)).toBeUndefined();
		});
	});

	describe("static convertLibReference", () => {
		it("converts lib.esnext.d.ts to esnext", () => {
			expect(TsconfigResolver.convertLibReference("lib.esnext.d.ts")).toBe("esnext");
		});

		it("converts lib.dom.d.ts to dom", () => {
			expect(TsconfigResolver.convertLibReference("lib.dom.d.ts")).toBe("dom");
		});

		it("handles a full path with forward slashes", () => {
			expect(TsconfigResolver.convertLibReference("/path/to/node_modules/typescript/lib/lib.dom.d.ts")).toBe("dom");
		});

		it("handles a full path with backslashes", () => {
			expect(TsconfigResolver.convertLibReference("C:\\path\\to\\typescript\\lib\\lib.dom.d.ts")).toBe("dom");
		});

		it("handles compound lib names", () => {
			expect(TsconfigResolver.convertLibReference("lib.es2022.intl.d.ts")).toBe("es2022.intl");
		});
	});

	describe("resolve", () => {
		it("includes the $schema", () => {
			const result = new TsconfigResolver().resolve(parsed({}));
			expect(result.$schema).toBe("https://json.schemastore.org/tsconfig");
		});

		it("converts the target enum", () => {
			const result = new TsconfigResolver().resolve(parsed({ target: ScriptTarget.ES2023 }));
			expect(result.compilerOptions.target).toBe("es2023");
		});

		it("always forces composite to false", () => {
			const result = new TsconfigResolver().resolve(parsed({ composite: true }));
			expect(result.compilerOptions.composite).toBe(false);
		});

		it("always forces noEmit to true", () => {
			const result = new TsconfigResolver().resolve(parsed({ noEmit: false }));
			expect(result.compilerOptions.noEmit).toBe(true);
		});

		it("converts module and moduleResolution enums", () => {
			const result = new TsconfigResolver().resolve(
				parsed({ module: ModuleKind.NodeNext, moduleResolution: ModuleResolutionKind.NodeNext }),
			);
			expect(result.compilerOptions.module).toBe("nodenext");
			expect(result.compilerOptions.moduleResolution).toBe("nodenext");
		});

		it("converts the jsx enum", () => {
			const result = new TsconfigResolver().resolve(parsed({ jsx: JsxEmit.Preserve }));
			expect(result.compilerOptions.jsx).toBe("preserve");
		});

		it("converts the lib array to short names", () => {
			const result = new TsconfigResolver().resolve(parsed({ lib: ["lib.esnext.d.ts", "lib.dom.d.ts"] }));
			expect(result.compilerOptions.lib).toEqual(["esnext", "dom"]);
		});

		it("includes boolean type-checking options when set", () => {
			const result = new TsconfigResolver().resolve(
				parsed({ strict: true, skipLibCheck: true, esModuleInterop: true, isolatedDeclarations: false }),
			);
			expect(result.compilerOptions.strict).toBe(true);
			expect(result.compilerOptions.skipLibCheck).toBe(true);
			expect(result.compilerOptions.esModuleInterop).toBe(true);
			expect(result.compilerOptions.isolatedDeclarations).toBe(false);
		});

		it("omits build-specific path options", () => {
			const result = new TsconfigResolver().resolve(
				parsed({ rootDir: "/p/src", outDir: "/p/dist", declarationDir: "/p/dist/types", baseUrl: "/p" }),
			);
			expect(result.compilerOptions).not.toHaveProperty("rootDir");
			expect(result.compilerOptions).not.toHaveProperty("outDir");
			expect(result.compilerOptions).not.toHaveProperty("declarationDir");
			expect(result.compilerOptions).not.toHaveProperty("baseUrl");
		});

		it("omits emit-related options", () => {
			const result = new TsconfigResolver().resolve(
				parsed({ declaration: true, declarationMap: true, emitDeclarationOnly: true, sourceMap: true }),
			);
			expect(result.compilerOptions).not.toHaveProperty("declaration");
			expect(result.compilerOptions).not.toHaveProperty("declarationMap");
			expect(result.compilerOptions).not.toHaveProperty("emitDeclarationOnly");
			expect(result.compilerOptions).not.toHaveProperty("sourceMap");
		});

		it("omits incremental", () => {
			const result = new TsconfigResolver().resolve(parsed({ incremental: true }));
			expect(result.compilerOptions).not.toHaveProperty("incremental");
		});

		it("omits paths, types, and typeRoots", () => {
			const result = new TsconfigResolver().resolve(
				parsed({ paths: { "@/*": ["src/*"] }, types: ["node"], typeRoots: ["/p/types"] }),
			);
			expect(result.compilerOptions).not.toHaveProperty("paths");
			expect(result.compilerOptions).not.toHaveProperty("types");
			expect(result.compilerOptions).not.toHaveProperty("typeRoots");
		});

		it("omits include/exclude", () => {
			const result = new TsconfigResolver().resolve(
				parsed({}, { include: ["src/**/*.ts"], exclude: ["node_modules"] }),
			);
			expect(result).not.toHaveProperty("include");
			expect(result).not.toHaveProperty("exclude");
		});

		it("omits undefined options", () => {
			const result = new TsconfigResolver().resolve(parsed({ strict: true }));
			expect(result.compilerOptions).not.toHaveProperty("target");
			expect(result.compilerOptions).not.toHaveProperty("module");
			expect(result.compilerOptions).not.toHaveProperty("declaration");
		});

		it("preserves string options like jsxImportSource", () => {
			const result = new TsconfigResolver().resolve(parsed({ jsxImportSource: "react", jsx: JsxEmit.ReactJSX }));
			expect(result.compilerOptions.jsxImportSource).toBe("react");
			expect(result.compilerOptions.jsx).toBe("react-jsx");
		});

		it("produces only $schema and compilerOptions (no path/file keys)", () => {
			const result = new TsconfigResolver().resolve(
				parsed(
					{ target: ScriptTarget.ES2023, module: ModuleKind.NodeNext, strict: true, rootDir: "/p", outDir: "/p/d" },
					{ include: ["src"], exclude: ["dist"] },
				),
			);
			expect(Object.keys(result).sort()).toEqual(["$schema", "compilerOptions"]);
			const json = JSON.stringify(result);
			expect(json).not.toContain("/p");
			expect(json).not.toContain("rootDir");
			expect(json).not.toContain("outDir");
		});
	});
});

describe("resolvePortableTsconfig", () => {
	it("resolves this package's effective options (follows extends), portable", () => {
		const cwd = new URL("../../", import.meta.url).pathname;
		const result = resolvePortableTsconfig(cwd);
		expect(result.$schema).toBe("https://json.schemastore.org/tsconfig");
		// Full effective options inherited from @savvy-web/bundler/ecma.json.
		expect(result.compilerOptions.target).toBe("es2023");
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
});

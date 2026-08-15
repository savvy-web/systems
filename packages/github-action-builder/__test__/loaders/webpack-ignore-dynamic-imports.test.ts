/**
 * Tests for the webpackIgnore-injecting rspack loader (build.nativeDynamicImports).
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// The loader is a genuine CommonJS file (rspack loaders load via require()); a
// scoped createRequire loads it from this ESM test module without a bundler.
const require = createRequire(import.meta.url);
const loader = require("../../public/loaders/webpack-ignore-dynamic-imports.cjs") as (source: string) => string;

describe("webpack-ignore-dynamic-imports loader", () => {
	it("injects webpackIgnore into a fully dynamic import()", () => {
		const source = "await import(changelogPath)";
		expect(loader(source)).toBe("await import(/* webpackIgnore: true */ changelogPath)");
	});

	it("leaves a string-literal import() untouched", () => {
		const source = 'import("./static.js")';
		expect(loader(source)).toBe(source);
	});

	it("does not double-inject when webpackIgnore is already present", () => {
		const source = "import(/* webpackIgnore: true */ x)";
		expect(loader(source)).toBe(source);
	});

	it("does not match an identifier merely containing 'import'", () => {
		const source = "important(x)";
		expect(loader(source)).toBe(source);
	});

	it("injects webpackIgnore into an interpolated template-literal import()", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional plain string containing literal backtick-quoted JS source, not a template literal.
		const source = "await import(`./x/${y}.js`)";
		// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional plain string containing literal backtick-quoted JS source, not a template literal.
		expect(loader(source)).toBe("await import(/* webpackIgnore: true */ `./x/${y}.js`)");
	});

	it("leaves a fully static template-literal import() untouched", () => {
		const source = "import(`./static.js`)";
		expect(loader(source)).toBe(source);
	});

	it("injects webpackIgnore alongside an existing non-ignore magic comment", () => {
		const source = 'import(/* webpackChunkName: "x" */ ident)';
		expect(loader(source)).toBe('import(/* webpackIgnore: true */ /* webpackChunkName: "x" */ ident)');
	});

	it("does not double-inject when webpackIgnore is present alongside another magic comment", () => {
		const source = 'import(/* webpackIgnore: true */ /* webpackChunkName: "x" */ ident)';
		expect(loader(source)).toBe(source);
	});

	it("leaves import( inside a line comment untouched", () => {
		const source = "// falls back to import(candidateUrl) at runtime\nconst x = 1;";
		expect(loader(source)).toBe(source);
	});

	it("leaves import( inside a block comment untouched", () => {
		const source = "/**\n * The dynamic `import(candidateUrl)` below loads it; prose import() too.\n */\nconst y = 2;";
		expect(loader(source)).toBe(source);
	});

	it("leaves import( inside a string literal untouched", () => {
		const source = 'const msg = "wrap import(url) in a try block";';
		expect(loader(source)).toBe(source);
	});

	it("leaves import( inside template-literal text untouched", () => {
		const source = "const msg = `never call import(url) directly`;";
		expect(loader(source)).toBe(source);
	});

	it("rewrites a real dynamic import while leaving a doc comment mentioning import() untouched", () => {
		const source = [
			"/**",
			" * The `import(candidateUrl)` below loads the entry point.",
			" */",
			"const load = () => import(candidateUrl);",
		].join("\n");
		const expected = [
			"/**",
			" * The `import(candidateUrl)` below loads the entry point.",
			" */",
			"const load = () => import(/* webpackIgnore: true */ candidateUrl);",
		].join("\n");
		expect(loader(source)).toBe(expected);
	});

	it("still rewrites a dynamic import after a regex literal containing slashes", () => {
		const source = "const parts = name.split(/[/\\\\]/);\nawait import(mod);";
		const expected = "const parts = name.split(/[/\\\\]/);\nawait import(/* webpackIgnore: true */ mod);";
		expect(loader(source)).toBe(expected);
	});
});

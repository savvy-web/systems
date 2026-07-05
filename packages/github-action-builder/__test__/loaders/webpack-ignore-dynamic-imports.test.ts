/**
 * Tests for the webpackIgnore-injecting rspack loader (build.nativeDynamicImports).
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// The loader is a genuine CommonJS file (rspack loaders load via require()); a
// scoped createRequire loads it from this ESM test module without a bundler.
const require = createRequire(import.meta.url);
// biome-ignore lint/correctness/useImportExtensions: the real file extension is .cjs, not .js — the rule's fix would break resolution.
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
});

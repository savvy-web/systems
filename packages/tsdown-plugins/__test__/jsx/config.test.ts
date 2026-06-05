import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readTsconfigJsx, resolveJsxConfig } from "../../src/jsx/config.js";

describe("resolveJsxConfig", () => {
	it("maps tsconfig react-jsx to automatic runtime with the import source", () => {
		expect(resolveJsxConfig({ jsx: "react-jsx", jsxImportSource: "react" }, undefined)).toEqual({
			runtime: "automatic",
			importSource: "react",
		});
	});

	it("defaults importSource to react for automatic runtime when unset", () => {
		expect(resolveJsxConfig({ jsx: "react-jsxdev" }, undefined)).toEqual({
			runtime: "automatic",
			importSource: "react",
		});
	});

	it("maps tsconfig react to classic runtime", () => {
		expect(resolveJsxConfig({ jsx: "react" }, undefined)).toEqual({ runtime: "classic" });
	});

	it("returns undefined for preserve or no jsx (nothing to configure)", () => {
		expect(resolveJsxConfig({ jsx: "preserve" }, undefined)).toBeUndefined();
		expect(resolveJsxConfig({}, undefined)).toBeUndefined();
	});

	it("an explicit override wins over tsconfig inference", () => {
		expect(resolveJsxConfig({ jsx: "react" }, { runtime: "automatic", importSource: "preact" })).toEqual({
			runtime: "automatic",
			importSource: "preact",
		});
	});

	it("an explicit automatic override defaults importSource to react", () => {
		expect(resolveJsxConfig({}, { runtime: "automatic" })).toEqual({ runtime: "automatic", importSource: "react" });
	});
});

describe("readTsconfigJsx", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "jsx-test-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("returns {} when tsconfig.json is absent", () => {
		expect(readTsconfigJsx(dir)).toEqual({});
	});

	it("returns {} on a JSON parse error", () => {
		writeFileSync(join(dir, "tsconfig.json"), "{ not json }");
		expect(readTsconfigJsx(dir)).toEqual({});
	});

	it("extracts jsx and jsxImportSource from compilerOptions", () => {
		writeFileSync(
			join(dir, "tsconfig.json"),
			JSON.stringify({ compilerOptions: { jsx: "react-jsx", jsxImportSource: "preact" } }),
		);
		expect(readTsconfigJsx(dir)).toEqual({ jsx: "react-jsx", jsxImportSource: "preact" });
	});

	it("omits keys absent from compilerOptions", () => {
		writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }));
		expect(readTsconfigJsx(dir)).toEqual({});
	});
});

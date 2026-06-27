// packages/tsdown-plugins/__test__/dts/relative-imports.test.ts
import { describe, expect, it } from "vitest";
import { findRelativeSpecifiers } from "../../src/dts/relative-imports.js";

describe("findRelativeSpecifiers", () => {
	it("returns [] for a self-contained ambient declaration (declare module + bare specifier)", () => {
		const src = `declare module "pkg/virtual/x" {\n  import type { Y } from "pkg/runtime";\n  export const y: Y;\n}\n`;
		expect(findRelativeSpecifiers(src)).toEqual([]);
	});
	it("flags a relative import", () => {
		expect(findRelativeSpecifiers(`import type { A } from "./neighbor.js";\n`)).toEqual(["./neighbor.js"]);
	});
	it("flags a relative export-from and a parent import", () => {
		const src = `export type { A } from "./a.js";\nimport type { B } from "../b.js";\n`;
		expect(findRelativeSpecifiers(src).sort()).toEqual(["../b.js", "./a.js"]);
	});
	it("flags a relative import() type node", () => {
		expect(findRelativeSpecifiers(`export type T = import("./mod.js").Thing;\n`)).toEqual(["./mod.js"]);
	});
	it("flags a relative triple-slash reference path", () => {
		expect(findRelativeSpecifiers(`/// <reference path="./other.d.ts" />\nexport {};\n`)).toEqual(["./other.d.ts"]);
	});
	it("deduplicates repeated specifiers", () => {
		const src = `import type { A } from "./a.js";\nimport type { B } from "./a.js";\n`;
		expect(findRelativeSpecifiers(src)).toEqual(["./a.js"]);
	});
	it("flags a relative import inside a declare module body", () => {
		const src = `declare module "pkg/v" {\n  import type { X } from "./x.js";\n  export const x: X;\n}\n`;
		expect(findRelativeSpecifiers(src)).toEqual(["./x.js"]);
	});
});

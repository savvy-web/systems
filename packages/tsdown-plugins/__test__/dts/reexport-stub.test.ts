// packages/tsdown-plugins/__test__/dts/reexport-stub.test.ts
import { describe, expect, it } from "vitest";
import { analyzeReexportBarrel, collectExportNames, renderReexportStub } from "../../src/dts/reexport-stub.js";

describe("analyzeReexportBarrel", () => {
	it("classifies named value vs type re-exports and reports a pure barrel", () => {
		const src = `
			export { A, B as Bee } from "./a.js";
			export type { T } from "./t.js";
			export { C } from "./c.js";
		`;
		const r = analyzeReexportBarrel(src);
		expect(r.isPureNamedReexportBarrel).toBe(true);
		expect([...r.valueNames].sort()).toEqual(["A", "Bee", "C"]);
		expect(r.typeNames).toEqual(["T"]);
	});

	it("treats `export type { … }` and per-specifier `type` modifiers as type-only", () => {
		const r = analyzeReexportBarrel(`export { type X, Y } from "./m.js";`);
		expect(r.typeNames).toEqual(["X"]);
		expect(r.valueNames).toEqual(["Y"]);
	});

	it("is NOT a pure barrel when a star re-export is present", () => {
		expect(analyzeReexportBarrel(`export * from "./a.js";`).isPureNamedReexportBarrel).toBe(false);
	});

	it("is NOT a pure barrel when a namespace re-export is present", () => {
		expect(analyzeReexportBarrel(`export * as NS from "./a.js";`).isPureNamedReexportBarrel).toBe(false);
	});

	it("is NOT a pure barrel when a local declaration is exported", () => {
		const src = `export { A } from "./a.js";\nexport const local = 1;`;
		expect(analyzeReexportBarrel(src).isPureNamedReexportBarrel).toBe(false);
	});

	it("is NOT a pure barrel for a bare local re-export without `from`", () => {
		const src = `import { A } from "./a.js";\nexport { A };`;
		expect(analyzeReexportBarrel(src).isPureNamedReexportBarrel).toBe(false);
	});
});

describe("collectExportNames", () => {
	it("collects named re-exports, namespace re-exports, and local exported declarations", () => {
		const src = `
			export { A, B as Bee } from "./a.js";
			export * as Step from "./step.js";
			export const c = 1;
			export function d() {}
			export class E {}
			export type F = string;
			export interface G {}
			export enum H {}
		`;
		const { names, complete } = collectExportNames(src);
		expect(complete).toBe(true);
		expect([...names].sort()).toEqual(["A", "Bee", "E", "F", "G", "H", "Step", "c", "d"]);
	});

	it("flags the name set as incomplete when a star re-export cannot be enumerated", () => {
		const { complete } = collectExportNames(`export * from "./a.js";`);
		expect(complete).toBe(false);
	});
});

describe("renderReexportStub", () => {
	it("renders sorted value and type re-exports from the base specifier", () => {
		const out = renderReexportStub({
			valueNames: ["B", "A"],
			typeNames: ["D", "C"],
			baseSpecifier: "./index.js",
		});
		expect(out).toBe('export { A, B } from "./index.js";\nexport type { C, D } from "./index.js";\n');
	});

	it("omits the value line when there are no value names, and points the cts variant at the cjs file", () => {
		const out = renderReexportStub({ valueNames: [], typeNames: ["T"], baseSpecifier: "./index.cjs" });
		expect(out).toBe('export type { T } from "./index.cjs";\n');
	});

	it("returns the empty string when there is nothing to re-export", () => {
		expect(renderReexportStub({ valueNames: [], typeNames: [], baseSpecifier: "./index.js" })).toBe("");
	});
});

// packages/tsdown-plugins/__test__/build/cjs-default-interop.test.ts
import { describe, expect, it } from "vitest";
import { cjsDefaultInterop } from "../../src/build/cjs-default-interop.js";

type RenderChunkFn = (
	code: string,
	chunk: { isEntry: boolean; exports: string[] },
	outputOptions: { format: string },
) => { code: string; map: null } | null;

/** Reach the renderChunk handler off the plugin object (object form, not a hook filter). */
function renderChunk(): RenderChunkFn {
	const plugin = cjsDefaultInterop();
	const hook = (plugin as { renderChunk?: unknown }).renderChunk;
	if (typeof hook !== "function") throw new Error("renderChunk hook not a function");
	return hook as RenderChunkFn;
}

const CODE = "exports.A = A;\nexports.B = B;\nexports.default = arr;\n";

describe("cjsDefaultInterop", () => {
	it("appends the interop footer to a cjs ENTRY chunk with default + named exports", () => {
		const out = renderChunk()(CODE, { isEntry: true, exports: ["A", "B", "default"] }, { format: "cjs" });
		expect(out).not.toBeNull();
		expect(out?.map).toBeNull();
		expect(out?.code).toContain(CODE);
		expect(out?.code).toContain("module.exports = __cjsDefault");
		// The footer must come AFTER the original exports so module.exports is fully populated.
		expect(out?.code.indexOf("module.exports = __cjsDefault")).toBeGreaterThan(
			out?.code.indexOf("exports.default = arr") ?? -1,
		);
	});

	it("is a no-op for the esm format (import().default is already correct)", () => {
		expect(renderChunk()(CODE, { isEntry: true, exports: ["A", "B", "default"] }, { format: "es" })).toBeNull();
		expect(renderChunk()(CODE, { isEntry: true, exports: ["A", "B", "default"] }, { format: "esm" })).toBeNull();
	});

	it("is a no-op for a SHARED (non-entry) chunk even with default + named", () => {
		// Shared chunks are required by their named bindings; promoting their module.exports
		// to the default would break the require graph.
		expect(renderChunk()(CODE, { isEntry: false, exports: ["A", "B", "default"] }, { format: "cjs" })).toBeNull();
	});

	it("is a no-op for a default-only chunk (rolldown already gives module.exports = default)", () => {
		expect(
			renderChunk()("exports.default = arr;\n", { isEntry: true, exports: ["default"] }, { format: "cjs" }),
		).toBeNull();
	});

	it("is a no-op for a named-only chunk (no default to promote)", () => {
		expect(renderChunk()("exports.A = A;\n", { isEntry: true, exports: ["A", "B"] }, { format: "cjs" })).toBeNull();
	});

	it("emits a footer that is self-guarded and re-attaches named exports onto the default", () => {
		const out = renderChunk()(CODE, { isEntry: true, exports: ["A", "B", "default"] }, { format: "cjs" });
		// Runtime-evaluate the emitted chunk as a CJS module to assert the resulting shape.
		const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
		const exportsRef = moduleObj.exports;
		const A = { names: ["a"] };
		const B = { names: ["b"] };
		const arr: unknown[] & { A?: unknown; B?: unknown } = [A, B];
		// Reproduce rolldown's emitted body: exports.A/B/default on the same `exports` object,
		// then the appended footer operating over `module`/`exports`.
		const body = `exports.A = A; exports.B = B; exports.default = arr;\n${out?.code.slice(CODE.length) ?? ""}`;
		// eslint-disable-next-line no-new-func
		new Function("module", "exports", "A", "B", "arr", body)(moduleObj, exportsRef, A, B, arr);
		// module.exports is now the array itself...
		expect(Array.isArray(moduleObj.exports)).toBe(true);
		expect(moduleObj.exports).toBe(arr as unknown as Record<string, unknown>);
		// ...with named exports attached as own properties.
		expect((moduleObj.exports as unknown as { A: unknown }).A).toBe(A);
		expect((moduleObj.exports as unknown as { B: unknown }).B).toBe(B);
	});
});

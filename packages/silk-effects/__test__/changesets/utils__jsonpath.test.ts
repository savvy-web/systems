import { describe, expect, it } from "vitest";

import { jsonPathGet, jsonPathResolve, jsonPathSet, parseJsonPath } from "../../src/changesets/utils/jsonpath.js";

describe("parseJsonPath", () => {
	it("parses simple property access", () => {
		expect(parseJsonPath("$.version")).toEqual([{ type: "property", key: "version" }]);
	});

	it("parses nested property access", () => {
		expect(parseJsonPath("$.metadata.version")).toEqual([
			{ type: "property", key: "metadata" },
			{ type: "property", key: "version" },
		]);
	});

	it("parses array wildcard", () => {
		expect(parseJsonPath("$.plugins[*].version")).toEqual([
			{ type: "property", key: "plugins" },
			{ type: "wildcard" },
			{ type: "property", key: "version" },
		]);
	});

	it("parses array index", () => {
		expect(parseJsonPath("$.items[0].name")).toEqual([
			{ type: "property", key: "items" },
			{ type: "index", index: 0 },
			{ type: "property", key: "name" },
		]);
	});

	it("parses deeply nested path", () => {
		expect(parseJsonPath("$.a.b[*].c[0].d")).toEqual([
			{ type: "property", key: "a" },
			{ type: "property", key: "b" },
			{ type: "wildcard" },
			{ type: "property", key: "c" },
			{ type: "index", index: 0 },
			{ type: "property", key: "d" },
		]);
	});

	it("returns empty array for root path", () => {
		expect(parseJsonPath("$.")).toEqual([]);
	});

	it("throws on invalid prefix", () => {
		expect(() => parseJsonPath("version")).toThrow('must start with "$."');
		expect(() => parseJsonPath(".version")).toThrow('must start with "$."');
	});
});

describe("jsonPathGet", () => {
	it("gets a top-level value", () => {
		expect(jsonPathGet({ version: "1.0.0" }, "$.version")).toEqual(["1.0.0"]);
	});

	it("gets a nested value", () => {
		const obj = { metadata: { version: "2.0.0" } };
		expect(jsonPathGet(obj, "$.metadata.version")).toEqual(["2.0.0"]);
	});

	it("gets values with array wildcard", () => {
		const obj = {
			plugins: [{ version: "1.0.0" }, { version: "2.0.0" }, { version: "3.0.0" }],
		};
		expect(jsonPathGet(obj, "$.plugins[*].version")).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
	});

	it("gets value by array index", () => {
		const obj = { items: ["a", "b", "c"] };
		expect(jsonPathGet(obj, "$.items[1]")).toEqual(["b"]);
	});

	it("returns empty array for missing property", () => {
		expect(jsonPathGet({ a: 1 }, "$.b")).toEqual([]);
	});

	it("returns empty array for missing nested property", () => {
		expect(jsonPathGet({ a: { b: 1 } }, "$.a.c")).toEqual([]);
	});

	it("returns empty array for null input", () => {
		expect(jsonPathGet(null, "$.version")).toEqual([]);
	});

	it("handles array wildcard on empty array", () => {
		expect(jsonPathGet({ items: [] }, "$.items[*].name")).toEqual([]);
	});

	it("handles index out of bounds", () => {
		expect(jsonPathGet({ items: ["a"] }, "$.items[5]")).toEqual([]);
	});
});

describe("jsonPathSet", () => {
	it("sets a top-level value", () => {
		const obj = { version: "1.0.0" };
		const count = jsonPathSet(obj, "$.version", "2.0.0");
		expect(count).toBe(1);
		expect(obj.version).toBe("2.0.0");
	});

	it("sets a nested value", () => {
		const obj = { metadata: { version: "1.0.0" } };
		const count = jsonPathSet(obj, "$.metadata.version", "2.0.0");
		expect(count).toBe(1);
		expect(obj.metadata.version).toBe("2.0.0");
	});

	it("sets values with array wildcard", () => {
		const obj = {
			plugins: [{ version: "1.0.0" }, { version: "1.0.0" }, { version: "1.0.0" }],
		};
		const count = jsonPathSet(obj, "$.plugins[*].version", "2.0.0");
		expect(count).toBe(3);
		expect(obj.plugins.every((p) => p.version === "2.0.0")).toBe(true);
	});

	it("sets value by array index", () => {
		const obj = { items: [{ v: "a" }, { v: "b" }] };
		const count = jsonPathSet(obj, "$.items[0].v", "x");
		expect(count).toBe(1);
		expect(obj.items[0].v).toBe("x");
		expect(obj.items[1].v).toBe("b");
	});

	it("returns 0 for missing property", () => {
		const obj = { a: 1 };
		const count = jsonPathSet(obj, "$.b", "new");
		expect(count).toBe(0);
		expect(obj).toEqual({ a: 1 });
	});

	it("returns 0 for null input", () => {
		expect(jsonPathSet(null, "$.version", "1.0.0")).toBe(0);
	});

	it("returns 0 for empty path", () => {
		const obj = { version: "1.0.0" };
		expect(jsonPathSet(obj, "$.", "2.0.0")).toBe(0);
	});

	it("does not create missing intermediate properties", () => {
		const obj: Record<string, unknown> = {};
		const count = jsonPathSet(obj, "$.a.b", "value");
		expect(count).toBe(0);
		expect(obj).toEqual({});
	});

	it("handles deep nested wildcard set", () => {
		const obj = {
			a: {
				items: [{ config: { version: "old" } }, { config: { version: "old" } }],
			},
		};
		const count = jsonPathSet(obj, "$.a.items[*].config.version", "new");
		expect(count).toBe(2);
		expect(obj.a.items[0].config.version).toBe("new");
		expect(obj.a.items[1].config.version).toBe("new");
	});
});

describe("jsonPathResolve", () => {
	it("resolves a top-level property to its concrete path", () => {
		expect(jsonPathResolve({ version: "1.0.0" }, "$.version")).toEqual([["version"]]);
	});

	it("resolves a nested property path", () => {
		expect(jsonPathResolve({ metadata: { version: "2.0.0" } }, "$.metadata.version")).toEqual([
			["metadata", "version"],
		]);
	});

	it("resolves wildcard matches to indexed concrete paths", () => {
		const obj = { plugins: [{ version: "1.0.0" }, { version: "2.0.0" }, { version: "3.0.0" }] };
		expect(jsonPathResolve(obj, "$.plugins[*].version")).toEqual([
			["plugins", 0, "version"],
			["plugins", 1, "version"],
			["plugins", 2, "version"],
		]);
	});

	it("resolves an array index path", () => {
		expect(jsonPathResolve({ items: ["a", "b", "c"] }, "$.items[1]")).toEqual([["items", 1]]);
	});

	it("resolves deep wildcard-plus-index paths", () => {
		const obj = { a: { items: [{ config: { version: "x" } }, { config: { version: "y" } }] } };
		expect(jsonPathResolve(obj, "$.a.items[*].config.version")).toEqual([
			["a", "items", 0, "config", "version"],
			["a", "items", 1, "config", "version"],
		]);
	});

	it("returns an empty array for a missing property", () => {
		expect(jsonPathResolve({ a: 1 }, "$.b")).toEqual([]);
	});

	it("returns an empty array for a wildcard over an empty array", () => {
		expect(jsonPathResolve({ items: [] }, "$.items[*].version")).toEqual([]);
	});

	it("returns an empty array for a null input", () => {
		expect(jsonPathResolve(null, "$.version")).toEqual([]);
	});

	it("returns an empty array for an out-of-bounds index", () => {
		expect(jsonPathResolve({ items: ["a"] }, "$.items[5]")).toEqual([]);
	});

	it("returns the root path for an empty path expression", () => {
		expect(jsonPathResolve({ version: "1.0.0" }, "$.")).toEqual([[]]);
	});

	it("returns an empty array for a wildcard over a non-array node", () => {
		expect(jsonPathResolve({ a: { x: 1 } }, "$.a[*]")).toEqual([]);
	});

	it("returns an empty array for an index over a non-array node", () => {
		expect(jsonPathResolve({ a: { x: 1 } }, "$.a[0]")).toEqual([]);
	});
});

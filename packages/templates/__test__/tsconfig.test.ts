import { describe, expect, it } from "vitest";
import { createTsConfig } from "../src/lib/tsconfig/index.js";

describe("tsconfig template", () => {
	it("creates minimal tsconfig with extends", () => {
		const result = createTsConfig({
			extends: "@savvy-web/rslib-builder/tsconfig/ecma/lib.json",
		});
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("tsconfig");
		expect(result[0].filename).toBe("tsconfig.json");

		const parsed = JSON.parse(result[0].content);
		expect(parsed.extends).toEqual(["@savvy-web/rslib-builder/tsconfig/ecma/lib.json"]);
	});

	it("handles array extends", () => {
		const result = createTsConfig({
			extends: ["./base.json", "./strict.json"],
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.extends).toEqual(["./base.json", "./strict.json"]);
	});

	it("includes composite and references", () => {
		const result = createTsConfig({
			composite: true,
			references: [{ path: "./packages/a" }, { path: "./packages/b" }],
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.composite).toBe(true);
		expect(parsed.references).toEqual([{ path: "./packages/a" }, { path: "./packages/b" }]);
	});

	it("includes include and exclude", () => {
		const result = createTsConfig({
			include: ["src/**/*.ts"],
			exclude: ["node_modules", "dist"],
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.include).toEqual(["src/**/*.ts"]);
		expect(parsed.exclude).toEqual(["node_modules", "dist"]);
	});

	it("omits undefined fields", () => {
		const result = createTsConfig({});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.extends).toBeUndefined();
		expect(parsed.composite).toBeUndefined();
		expect(parsed.references).toBeUndefined();
	});
});

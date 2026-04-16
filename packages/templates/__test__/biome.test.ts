import { describe, expect, it } from "vitest";
import { createBiome } from "../src/lib/biome/index.js";

describe("biome template", () => {
	it("creates biome.jsonc with schema URL", () => {
		const result = createBiome({ version: "2.3.3" });
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("biome");
		expect(result[0].filename).toBe("biome.jsonc");

		const parsed = JSON.parse(result[0].content);
		expect(parsed.$schema).toBe("https://biomejs.dev/schemas/2.3.3/schema.json");
	});

	it("includes extends array", () => {
		const result = createBiome({
			version: "2.3.3",
			extends: ["@savvy-web/biome-config"],
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.extends).toEqual(["@savvy-web/biome-config"]);
	});

	it("includes root flag", () => {
		const result = createBiome({ version: "2.3.3", root: true });
		const parsed = JSON.parse(result[0].content);
		expect(parsed.root).toBe(true);
	});

	it("omits root when not provided", () => {
		const result = createBiome({ version: "2.3.3" });
		const parsed = JSON.parse(result[0].content);
		expect(parsed.root).toBeUndefined();
	});

	it("requires version", () => {
		// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test schema validation
		expect(() => createBiome({} as any)).toThrow();
	});
});

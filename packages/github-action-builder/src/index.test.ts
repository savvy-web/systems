/**
 * Tests for public API exports.
 */
import { describe, expect, it } from "vitest";
import { defineConfig } from "./index.js";

describe("defineConfig", () => {
	it("should return config with defaults when given empty object", () => {
		const config = defineConfig({});

		expect(config.entries.main).toBe("src/main.ts");
		expect(config.build.minify).toBe(true);
		expect(config.build.sourceMap).toBe(false);
		expect(config.validation.requireActionYml).toBe(true);
	});

	it("should allow overriding specific options", () => {
		const config = defineConfig({
			entries: {
				main: "src/action.ts",
				post: "src/cleanup.ts",
			},
			build: {
				minify: false,
			},
		});

		expect(config.entries.main).toBe("src/action.ts");
		expect(config.entries.post).toBe("src/cleanup.ts");
		expect(config.entries.pre).toBeUndefined();
		expect(config.build.minify).toBe(false);
		expect(config.build.sourceMap).toBe(false); // default preserved
	});

	it("should merge partial config with defaults", () => {
		const config = defineConfig({
			build: { minify: false },
		});

		expect(config.build.minify).toBe(false);
		expect(config.entries.main).toBe("src/main.ts");
	});
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural regression tests for the shipped Biome asset (public/biome/silk.jsonc).
 *
 * Guards the useImportExtensions configuration against the forceJsExtensions
 * regression (systems#359, upstream biomejs/biome#7734): forceJsExtensions
 * rewrites EVERY flagged import to `.js`, including correct `.json` asset
 * imports, which breaks module resolution. The asset must use extensionMappings
 * instead, which only rewrites the listed source extensions and leaves unmapped
 * extensions (json, css, ...) at the imported file's real extension.
 */

interface UseImportExtensionsOptions {
	readonly extensionMappings?: Record<string, string>;
	readonly forceJsExtensions?: boolean;
}

interface SilkBiomeConfig {
	readonly linter: {
		readonly rules: {
			readonly correctness: {
				readonly useImportExtensions: {
					readonly level: string;
					readonly options?: UseImportExtensionsOptions;
				};
			};
		};
	};
	readonly overrides: ReadonlyArray<{
		readonly linter?: {
			readonly rules?: {
				readonly correctness?: Record<string, unknown>;
			};
		};
	}>;
}

const loadAsset = (): SilkBiomeConfig => {
	const raw = readFileSync(join(import.meta.dirname, "..", "public", "biome", "silk.json"), "utf8");
	// The asset only uses full-line // comments; strip them so JSON.parse works.
	const json = raw
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("//"))
		.join("\n");
	return JSON.parse(json) as SilkBiomeConfig;
};

describe("biome asset", () => {
	const config = loadAsset();
	const rule = config.linter.rules.correctness.useImportExtensions;

	it("keeps useImportExtensions enabled at error level", () => {
		expect(rule.level).toBe("error");
	});

	it("never uses forceJsExtensions (rewrites correct .json imports to .js — systems#359)", () => {
		expect(rule.options?.forceJsExtensions).toBeUndefined();
	});

	it("maps every TypeScript source extension to its emitted JS extension", () => {
		expect(rule.options?.extensionMappings).toMatchObject({
			cts: "cjs",
			mts: "mjs",
			ts: "js",
			tsx: "js",
		});
	});

	it("leaves asset extensions (json, css) unmapped so they keep their real extension", () => {
		const mappings = rule.options?.extensionMappings ?? {};
		expect(mappings).not.toHaveProperty("json");
		expect(mappings).not.toHaveProperty("css");
	});

	it("has no override re-configuring useImportExtensions", () => {
		const overriding = config.overrides.filter((override) =>
			Object.hasOwn(override.linter?.rules?.correctness ?? {}, "useImportExtensions"),
		);
		expect(overriding).toEqual([]);
	});
});

import { describe, expect, it } from "vitest";

/**
 * Structural shape tests for lint config-integration shims.
 *
 * Asserts the ORIGINAL module shape from @savvy-web/lint-staged (root export)
 * so that a consumer lint-staged.config.ts that imported from @savvy-web/lint-staged
 * works unchanged against @savvy-web/silk/lint.
 *
 * Omissions (intentionally excluded from this shim):
 *   - checkCommand, fmtCommand, initCommand, rootCommand, runCli
 *     These are @effect/cli-based CLI commands that live in cli/index.ts,
 *     which was explicitly NOT copied into the Lint namespace (Phase A decision).
 *     A lint-staged.config consumer never imports these; they belong to the
 *     future @savvy-web/cli Phase B implementation.
 */

describe("lint shims", () => {
	describe("root (@savvy-web/silk/lint)", () => {
		// ===== Handlers =====

		it("exports Biome handler with glob, handler, create(), and findBiome()", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.Biome).toBeDefined();
			expect(typeof mod.Biome.glob).toBe("string");
			expect(mod.Biome.glob.length).toBeGreaterThan(0);
			expect(mod.Biome.handler).toBeDefined();
			expect(typeof mod.Biome.create).toBe("function");
			expect(typeof mod.Biome.findBiome).toBe("function");
		});

		it("exports Markdown handler with glob and create()", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.Markdown).toBeDefined();
			expect(typeof mod.Markdown.glob).toBe("string");
			expect(mod.Markdown.glob.length).toBeGreaterThan(0);
			expect(typeof mod.Markdown.create).toBe("function");
		});

		it("exports PackageJson handler with glob and handler", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.PackageJson).toBeDefined();
			expect(typeof mod.PackageJson.glob).toBe("string");
			expect(mod.PackageJson.handler).toBeDefined();
		});

		it("exports PnpmWorkspace handler with glob and handler", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.PnpmWorkspace).toBeDefined();
			expect(typeof mod.PnpmWorkspace.glob).toBe("string");
			expect(mod.PnpmWorkspace.handler).toBeDefined();
		});

		it("exports ShellScripts handler with glob and create()", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.ShellScripts).toBeDefined();
			expect(typeof mod.ShellScripts.glob).toBe("string");
			expect(mod.ShellScripts.glob.length).toBeGreaterThan(0);
			expect(typeof mod.ShellScripts.create).toBe("function");
		});

		it("exports TypeScript handler with glob and create()", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.TypeScript).toBeDefined();
			expect(typeof mod.TypeScript.glob).toBe("string");
			expect(mod.TypeScript.glob.length).toBeGreaterThan(0);
			expect(typeof mod.TypeScript.create).toBe("function");
		});

		it("exports Yaml handler with glob and handler", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.Yaml).toBeDefined();
			expect(typeof mod.Yaml.glob).toBe("string");
			expect(mod.Yaml.glob.length).toBeGreaterThan(0);
			expect(mod.Yaml.handler).toBeDefined();
		});

		it("exports Handler abstract base class", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.Handler).toBeDefined();
			// Handler is an abstract class — it is a function (constructor)
			expect(typeof mod.Handler).toBe("function");
		});

		// ===== Config =====

		it("exports Preset class with silk(), standard(), minimal(), and get() static methods", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.Preset).toBeDefined();
			expect(typeof mod.Preset.silk).toBe("function");
			expect(typeof mod.Preset.standard).toBe("function");
			expect(typeof mod.Preset.minimal).toBe("function");
			expect(typeof mod.Preset.get).toBe("function");
		});

		it("Preset.silk() returns a non-empty lint-staged config object", async () => {
			const mod = await import("../src/lint/index.js");
			const config = mod.Preset.silk();
			expect(config).toBeTypeOf("object");
			expect(Object.keys(config).length).toBeGreaterThan(0);
		});

		it("Preset.standard() returns a non-empty lint-staged config object", async () => {
			const mod = await import("../src/lint/index.js");
			const config = mod.Preset.standard();
			expect(config).toBeTypeOf("object");
			expect(Object.keys(config).length).toBeGreaterThan(0);
		});

		it("Preset.minimal() returns a non-empty lint-staged config object", async () => {
			const mod = await import("../src/lint/index.js");
			const config = mod.Preset.minimal();
			expect(config).toBeTypeOf("object");
			expect(Object.keys(config).length).toBeGreaterThan(0);
		});

		it("exports createConfig as a function", async () => {
			const mod = await import("../src/lint/index.js");
			expect(typeof mod.createConfig).toBe("function");
		});

		// ===== Utils =====

		it("exports Command utility class with findTool and isAvailable static methods", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.Command).toBeDefined();
			expect(typeof mod.Command.findTool).toBe("function");
			expect(typeof mod.Command.isAvailable).toBe("function");
		});

		it("exports Filter utility class with exclude and shellEscape static methods", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.Filter).toBeDefined();
			expect(typeof mod.Filter.exclude).toBe("function");
			expect(typeof mod.Filter.shellEscape).toBe("function");
		});

		it("exports workspace utility functions", async () => {
			const mod = await import("../src/lint/index.js");
			expect(typeof mod.getWorkspaceRoot).toBe("function");
			expect(typeof mod.getWorkspacePackages).toBe("function");
			expect(typeof mod.getWorkspacePackagePaths).toBe("function");
			expect(typeof mod.isWorkspacePackagePath).toBe("function");
			expect(typeof mod.resetWorkspaceCache).toBe("function");
		});

		// ===== silk-effects passthrough exports =====

		it("exports ConfigDiscovery service and ConfigDiscoveryLive layer", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.ConfigDiscovery).toBeDefined();
			expect(mod.ConfigDiscoveryLive).toBeDefined();
		});

		// ===== Section / template data exports =====

		it("exports SavvyLintSectionDef and LegacySavvyLintHygieneDef", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.SavvyLintSectionDef).toBeDefined();
			expect(mod.LegacySavvyLintHygieneDef).toBeDefined();
		});

		it("exports savvyLintBlock and generateManagedContent as functions", async () => {
			const mod = await import("../src/lint/index.js");
			expect(typeof mod.savvyLintBlock).toBe("function");
			expect(typeof mod.generateManagedContent).toBe("function");
		});

		it("exports path constants", async () => {
			const mod = await import("../src/lint/index.js");
			expect(typeof mod.HUSKY_HOOK_PATH).toBe("string");
			expect(typeof mod.POST_CHECKOUT_HOOK_PATH).toBe("string");
			expect(typeof mod.POST_MERGE_HOOK_PATH).toBe("string");
			expect(typeof mod.DEFAULT_CONFIG_PATH).toBe("string");
			expect(typeof mod.MARKDOWNLINT_CONFIG_PATH).toBe("string");
		});

		it("exports markdownlint template data", async () => {
			const mod = await import("../src/lint/index.js");
			expect(mod.MARKDOWNLINT_CONFIG).toBeDefined();
			expect(mod.MARKDOWNLINT_SCHEMA).toBeDefined();
			expect(mod.MARKDOWNLINT_TEMPLATE).toBeDefined();
		});
	});
});

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@effected/workspaces";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfigDiscovery, ConfigDiscoveryLive, Lint } from "../../src/index.js";

const {
	Biome,
	Command,
	Filter,
	Markdown,
	PackageJson,
	PnpmWorkspace,
	Preset,
	ShellScripts,
	TypeScript,
	Yaml,
	createConfig,
} = Lint;

import { resetWorkspaceCache } from "../../src/lint/utils/Workspace.js";

// Mock @effected/workspaces so workspace detection does not interfere with tests.
// By default the mocks return null (not in a workspace), which causes
// isWorkspacePackagePath() to fall back to permissive mode (returns true for all paths).
vi.mock("@effected/workspaces", async (importOriginal) => {
	const mod = await importOriginal<typeof import("@effected/workspaces")>();
	return {
		...mod,
		findWorkspaceRootSync: vi.fn((): string | null => null),
		getWorkspacePackagesSync: vi.fn(() => []),
	};
});

// Test fixtures directory for handler tests
const FIXTURES_DIR: string = join(import.meta.dirname, "fixtures");

describe("Handler classes", () => {
	beforeAll(() => {
		// Create test fixtures directory
		if (!existsSync(FIXTURES_DIR)) {
			mkdirSync(FIXTURES_DIR, { recursive: true });
		}
	});

	afterAll(() => {
		// Clean up test fixtures
		if (existsSync(FIXTURES_DIR)) {
			rmSync(FIXTURES_DIR, { recursive: true });
		}
	});

	describe("PackageJson", () => {
		beforeAll(async () => {
			// Ensure workspace cache is clear so mock (no workspace = permissive) takes effect
			const { resetWorkspaceCache } = await import("../../src/lint/utils/Workspace.js");
			resetWorkspaceCache();
		});

		afterAll(async () => {
			// Clear workspace cache after PackageJson tests finish
			const { resetWorkspaceCache } = await import("../../src/lint/utils/Workspace.js");
			resetWorkspaceCache();
		});

		it("should have correct glob pattern", () => {
			expect(PackageJson.glob).toBe("**/package.json");
		});

		it("should have default excludes", () => {
			expect(PackageJson.defaultExcludes).toContain("dist/package.json");
			expect(PackageJson.defaultExcludes).toContain("__fixtures__");
		});

		it("should filter excluded files and sort in-place", () => {
			// Create a test package.json with unsorted keys
			const testFile = join(FIXTURES_DIR, "package.json");
			const unsorted = '{"version": "1.0.0", "name": "test"}';
			writeFileSync(testFile, unsorted, "utf-8");

			const handler = PackageJson.create();
			const result = handler([testFile, "dist/package.json", "__fixtures__/package.json"]);

			// Should return biome command (lint-staged auto-stages modified files)
			expect(result).toBe(`biome check --write --max-diagnostics=none '${testFile}'`);

			// File should have been sorted (name before version)
			const sorted = readFileSync(testFile, "utf-8");
			expect(sorted).toContain('"name"');
			expect(sorted.indexOf('"name"')).toBeLessThan(sorted.indexOf('"version"'));
		});

		it("should skip sort when option is set", () => {
			// Create a test package.json with unsorted keys
			const testFile = join(FIXTURES_DIR, "skip-sort-package.json");
			const unsorted = '{"version": "1.0.0", "name": "test"}';
			writeFileSync(testFile, unsorted, "utf-8");

			const handler = PackageJson.create({ skipSort: true });
			const result = handler([testFile]);

			expect(result).toBe(`biome check --write --max-diagnostics=none '${testFile}'`);

			// File should NOT have been sorted
			const content = readFileSync(testFile, "utf-8");
			expect(content).toBe(unsorted);
		});

		it("should skip biome when skipFormat is set", () => {
			const testFile = join(FIXTURES_DIR, "skip-format-package.json");
			const unsorted = '{"version": "1.0.0", "name": "test"}';
			writeFileSync(testFile, unsorted, "utf-8");

			const handler = PackageJson.create({ skipFormat: true });
			const result = handler([testFile]);

			// Should return empty (no biome command)
			expect(result).toEqual([]);

			// File should still have been sorted
			const content = readFileSync(testFile, "utf-8");
			expect(content.indexOf('"name"')).toBeLessThan(content.indexOf('"version"'));
		});

		it("should return sort CLI command via fmtCommand", () => {
			const handler = PackageJson.fmtCommand();
			const result = handler(["src/package.json", "dist/package.json"]);

			// Command resolves dynamically (savvy-lint or node fallback)
			expect(result).toContain("fmt package-json 'src/package.json'");
			// dist/package.json should be excluded by default
			expect(result).not.toContain("dist/package.json");
		});

		it("should return empty array when all files excluded", () => {
			const handler = PackageJson.create();
			const result = handler(["dist/package.json"]);
			expect(result).toEqual([]);
		});

		it("should filter to workspace roots only via fmtCommand", async () => {
			const { findWorkspaceRootSync, getWorkspacePackagesSync } = await import("@effected/workspaces");
			const { resetWorkspaceCache } = await import("../../src/lint/utils/Workspace.js");

			vi.mocked(findWorkspaceRootSync).mockReturnValue("/repo");
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([
				{ name: "@org/a", path: "/repo/packages/a" },
			] as unknown as ReturnType<typeof getWorkspacePackagesSync>);
			resetWorkspaceCache();

			const handler = PackageJson.fmtCommand();
			const result = handler([
				"/repo/package.json",
				"/repo/packages/a/package.json",
				"/repo/packages/a/dist/package.json",
				"/repo/node_modules/foo/package.json",
			]);

			expect(result).toContain("/repo/package.json");
			expect(result).toContain("/repo/packages/a/package.json");
			expect(result).not.toContain("dist/package.json");
			expect(result).not.toContain("node_modules");

			// Restore to non-workspace default for remaining tests
			vi.mocked(findWorkspaceRootSync).mockReturnValue(null);
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([]);
			resetWorkspaceCache();
		});
	});

	describe("Biome", () => {
		it("should have correct glob pattern", () => {
			expect(Biome.glob).toBe("*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}");
		});

		it("should filter excluded files", () => {
			const handler = Biome.create();
			const result = handler(["src/index.ts", "package-lock.json", "__fixtures__/test.ts"]);
			expect(result).toContain("biome check --write --no-errors-on-unmatched");
			expect(result).toContain("src/index.ts");
			expect(result).not.toContain("package-lock.json");
		});

		it("should accept custom config", () => {
			const handler = Biome.create({ config: "./custom-biome.json" });
			const result = handler(["src/index.ts"]);
			expect(result).toContain("--config-path=./custom-biome.json");
		});

		it("should have findConfig method", () => {
			expect(typeof Biome.findConfig).toBe("function");
		});

		it("should have findBiome method", () => {
			expect(typeof Biome.findBiome).toBe("function");
		});

		it("should have isAvailable method", () => {
			expect(typeof Biome.isAvailable).toBe("function");
			// Biome is a dev dependency, so it should be available
			expect(Biome.isAvailable()).toBe(true);
		});

		it("should find biome config at workspace root", () => {
			const mockFindRoot = vi.mocked(findWorkspaceRootSync);
			const mockGetPackages = vi.mocked(getWorkspacePackagesSync);
			mockFindRoot.mockReturnValue(process.cwd());
			mockGetPackages.mockReturnValue([]);
			resetWorkspaceCache();

			const config = Biome.findConfig();
			// This repo has biome.jsonc at root
			expect(config).toMatch(/biome\.jsonc?$/);

			resetWorkspaceCache();
			mockFindRoot.mockReturnValue(null);
			mockGetPackages.mockReturnValue([]);
		});

		it("should find all biome configs across workspace roots", () => {
			// Mock workspace with one leaf package
			const mockFindRoot = vi.mocked(findWorkspaceRootSync);
			const mockGetPackages = vi.mocked(getWorkspacePackagesSync);
			const cwd = process.cwd();
			mockFindRoot.mockReturnValue(cwd);
			mockGetPackages.mockReturnValue([{ name: "@org/a", path: join(cwd, "packages/a") }] as unknown as ReturnType<
				typeof getWorkspacePackagesSync
			>);
			resetWorkspaceCache();

			const configs = Biome.findAllConfigs();
			// Should find at least the root biome.jsonc
			expect(configs.length).toBeGreaterThanOrEqual(1);
			expect(configs[0]).toMatch(/biome\.jsonc?$/);

			resetWorkspaceCache();
			mockFindRoot.mockReturnValue(null);
			mockGetPackages.mockReturnValue([]);
		});

		it("should return absolute paths in findAllConfigs fallback when not in a workspace", () => {
			const mockFindRoot = vi.mocked(findWorkspaceRootSync);
			mockFindRoot.mockReturnValue(null);
			resetWorkspaceCache();

			const configs = Biome.findAllConfigs();
			// This repo has biome.jsonc at CWD — fallback should return absolute path
			if (configs.length > 0) {
				expect(configs[0]).toMatch(/^\//); // absolute path
				expect(configs[0]).toMatch(/biome\.jsonc?$/);
			}

			resetWorkspaceCache();
		});
	});

	describe("Markdown", () => {
		it("should have correct glob pattern", () => {
			expect(Markdown.glob).toBe("**/*.{md,mdx}");
		});

		it("should use explicit config when provided", () => {
			const handler = Markdown.create({ config: "./custom.jsonc" });
			const result = handler(["README.md"]);
			expect(result).toContain("--config './custom.jsonc'");
			expect(result).toContain("--fix");
		});

		it("should work without config (auto-discovery)", () => {
			const handler = Markdown.create();
			const result = handler(["README.md"]);
			expect(result).toContain("markdownlint-cli2");
			expect(result).toContain("--fix");
			expect(result).toContain("README.md");
		});

		it("should respect noFix option", () => {
			const handler = Markdown.create({ noFix: true });
			const result = handler(["README.md"]);
			expect(result).not.toContain("--fix");
		});

		it("should have findMarkdownlint method", () => {
			expect(typeof Markdown.findMarkdownlint).toBe("function");
		});

		it("should have isAvailable method", () => {
			expect(typeof Markdown.isAvailable).toBe("function");
			// markdownlint-cli2 is a dev dependency, so it should be available
			expect(Markdown.isAvailable()).toBe(true);
		});
	});

	describe("Yaml", () => {
		it("should have correct glob pattern", () => {
			expect(Yaml.glob).toBe("**/*.{yml,yaml}");
		});

		it("should exclude pnpm files by default and format in-place", async () => {
			// Create a test YAML file with valid but unformatted content
			const testFile = join(FIXTURES_DIR, "config.yaml");
			const unformatted = "key:   value\nother:    value2";
			writeFileSync(testFile, unformatted, "utf-8");

			// Use explicit excludes so the fixture file (inside __test__/fixtures) is not filtered out
			const handler = Yaml.create({ exclude: ["pnpm-lock.yaml", "pnpm-workspace.yaml"] });
			const result = await handler([testFile, "pnpm-lock.yaml", "pnpm-workspace.yaml"]);

			// Formatting is done in-place; lint-staged auto-stages modified files
			expect(result).toEqual([]);

			// File should be formatted by Prettier (extra spaces removed)
			const formatted = readFileSync(testFile, "utf-8");
			expect(formatted).toContain("key: value");
			expect(formatted).toContain("other: value2");
		});

		it("should skip formatting when option is set", async () => {
			const testFile = join(FIXTURES_DIR, "skip-format.yaml");
			const content = "key:   value\n";
			writeFileSync(testFile, content, "utf-8");

			// Use explicit excludes so the fixture file (inside __test__/fixtures) is not filtered out
			const handler = Yaml.create({
				skipFormat: true,
				skipValidate: true,
				exclude: ["pnpm-lock.yaml", "pnpm-workspace.yaml"],
			});
			const result = await handler([testFile]);

			expect(result).toEqual([]);
			// File should not be modified
			expect(readFileSync(testFile, "utf-8")).toBe(content);
		});

		it("should validate and reject invalid YAML", async () => {
			const testFile = join(FIXTURES_DIR, "invalid.yaml");
			writeFileSync(testFile, "key: value\n  invalid: indent", "utf-8");

			// Use explicit excludes so the fixture file (inside __test__/fixtures) is not filtered out
			const handler = Yaml.create({ skipFormat: true, exclude: ["pnpm-lock.yaml", "pnpm-workspace.yaml"] });
			await expect(handler([testFile])).rejects.toThrow("Invalid YAML");
		});

		it("should have findConfig and isAvailable static methods", () => {
			expect(typeof Yaml.findConfig).toBe("function");
			expect(typeof Yaml.isAvailable).toBe("function");
			expect(Yaml.isAvailable()).toBe(true);
		});

		it("should have formatFile and validateFile static methods", () => {
			expect(typeof Yaml.formatFile).toBe("function");
			expect(typeof Yaml.validateFile).toBe("function");
		});

		it("should return CLI command via fmtCommand", () => {
			const handler = Yaml.fmtCommand();
			const result = handler(["config.yaml", "pnpm-lock.yaml"]);
			// Should exclude pnpm-lock.yaml by default and return fmt command
			expect(result).toContain("fmt yaml");
			expect(result).toContain("config.yaml");
			expect(result).not.toContain("pnpm-lock.yaml");
		});

		it("should return empty via fmtCommand when all files excluded", () => {
			const handler = Yaml.fmtCommand();
			const result = handler(["pnpm-lock.yaml", "pnpm-workspace.yaml"]);
			expect(result).toEqual([]);
		});

		it("should return empty when all files are excluded", async () => {
			const handler = Yaml.create();
			const result = await handler(["pnpm-lock.yaml"]);
			expect(result).toEqual([]);
		});

		it("should have loadConfig method that handles errors", () => {
			// loadConfig with nonexistent file returns undefined
			const result = Yaml.loadConfig("/nonexistent/config.json");
			expect(result).toBeUndefined();
		});
	});

	describe("PnpmWorkspace", () => {
		it("should have correct glob pattern", () => {
			expect(PnpmWorkspace.glob).toBe("pnpm-workspace.yaml");
		});

		// Regression guard: @effected/yaml emits unindented block sequences and
		// single-quoted scalars. formatContent normalizes both back to the repo's
		// byte format via Prettier. Writing raw kit output reformats the whole
		// workspace file on every `savvy lint fmt pnpm-workspace` run.
		it("should normalize kit output to indented sequences and double quotes", async () => {
			const formatted = await PnpmWorkspace.formatContent({
				packages: ["e2e/*", "packages/*"],
				allowedDeprecatedVersions: { "@types/acorn": "*" },
			});

			expect(formatted).toContain("  - e2e/*");
			expect(formatted).not.toContain("\n- e2e/*");
			expect(formatted).toContain('"@types/acorn": "*"');
			expect(formatted).not.toContain("'@types/acorn'");
		});

		it("should sort and format in-place", async () => {
			// Create a backup of the actual file
			const filepath = "pnpm-workspace.yaml";
			const original = readFileSync(filepath, "utf-8");

			try {
				// Write unsorted content
				const unsorted = "onlyBuiltDependencies:\n  - zlib\n  - abc\npackages:\n  - z-pkg\n  - a-pkg\n";
				writeFileSync(filepath, unsorted, "utf-8");

				// v4: the handler is async (kit stringify + prettier normalization)
				const handler = PnpmWorkspace.create();
				const result = await handler([]);

				// Sorting/formatting is done in-place; lint-staged auto-stages modified files
				expect(result).toEqual([]);

				// File should be sorted and formatted
				const content = readFileSync(filepath, "utf-8");
				// packages should be first (sorted), and both arrays should be sorted
				expect(content.indexOf("packages")).toBeLessThan(content.indexOf("onlyBuiltDependencies"));
				expect(content.indexOf("a-pkg")).toBeLessThan(content.indexOf("z-pkg"));
				expect(content.indexOf("abc")).toBeLessThan(content.indexOf("zlib"));
			} finally {
				// Restore original file
				writeFileSync(filepath, original, "utf-8");
			}
		});

		it("should have sortContent static method", () => {
			expect(typeof PnpmWorkspace.sortContent).toBe("function");

			const sorted = PnpmWorkspace.sortContent({
				onlyBuiltDependencies: ["z", "a"],
				packages: ["z-pkg", "a-pkg"],
			});

			expect(sorted.packages).toEqual(["a-pkg", "z-pkg"]);
			expect(sorted.onlyBuiltDependencies).toEqual(["a", "z"]);
			// packages should be first key
			expect(Object.keys(sorted)[0]).toBe("packages");
		});

		it("should handle skipSort option", async () => {
			const filepath = "pnpm-workspace.yaml";
			const original = readFileSync(filepath, "utf-8");

			try {
				const content = "packages:\n  - z-pkg\n  - a-pkg\n";
				writeFileSync(filepath, content, "utf-8");

				const handler = PnpmWorkspace.create({ skipSort: true });
				const result = await handler([]);
				// Should still format (skipFormat defaults to false)
				expect(result).toEqual([]);
			} finally {
				writeFileSync(filepath, original, "utf-8");
			}
		});

		it("should return empty when both skipSort and skipFormat are true", async () => {
			const filepath = "pnpm-workspace.yaml";
			const original = readFileSync(filepath, "utf-8");

			try {
				const content = "packages:\n  - z-pkg\n";
				writeFileSync(filepath, content, "utf-8");

				const handler = PnpmWorkspace.create({ skipSort: true, skipFormat: true });
				const result = await handler([]);
				expect(result).toEqual([]);
				// Content should be unchanged
				expect(readFileSync(filepath, "utf-8")).toBe(content);
			} finally {
				writeFileSync(filepath, original, "utf-8");
			}
		});

		it("should throw on invalid YAML when skipLint is false", async () => {
			const filepath = "pnpm-workspace.yaml";
			const original = readFileSync(filepath, "utf-8");

			try {
				writeFileSync(filepath, ":\n  invalid: [\nyaml", "utf-8");
				// v4: the handler is async, so the throw surfaces as a rejection.
				const handler = PnpmWorkspace.create();
				await expect(handler([])).rejects.toThrow("Invalid YAML");
			} finally {
				writeFileSync(filepath, original, "utf-8");
			}
		});

		it("should return empty on invalid YAML when skipLint is true", async () => {
			const filepath = "pnpm-workspace.yaml";
			const original = readFileSync(filepath, "utf-8");

			try {
				writeFileSync(filepath, ":\n  invalid: [\nyaml", "utf-8");
				const handler = PnpmWorkspace.create({ skipLint: true });
				const result = await handler([]);
				expect(result).toEqual([]);
			} finally {
				writeFileSync(filepath, original, "utf-8");
			}
		});

		it("should handle fmtCommand method", () => {
			const handler = PnpmWorkspace.fmtCommand();
			const result = handler([]);
			// Should return a fmt command string
			expect(result).toContain("fmt pnpm-workspace");
		});

		it("should sort non-array values without modification", () => {
			const sorted = PnpmWorkspace.sortContent({
				packages: ["b", "a"],
				customKey: "string-value",
			});
			expect(sorted.customKey).toBe("string-value");
			expect(sorted.packages).toEqual(["a", "b"]);
		});
	});

	describe("ShellScripts", () => {
		it("should have correct glob pattern", () => {
			expect(ShellScripts.glob).toBe("**/*.sh");
		});

		it("should exclude .claude/scripts by default", () => {
			const handler = ShellScripts.create();
			const result = handler(["scripts/build.sh", ".claude/scripts/hook.sh"]);
			expect(result).toEqual(["chmod -x scripts/build.sh"]);
		});

		it("should make executable when option is set", () => {
			const handler = ShellScripts.create({ makeExecutable: true });
			const result = handler(["scripts/build.sh"]);
			expect(result).toEqual(["chmod +x scripts/build.sh"]);
		});
	});

	describe("TypeScript", () => {
		it("should have correct glob pattern", () => {
			expect(TypeScript.glob).toBe("*.{ts,cts,mts,tsx}");
		});

		// Stub Command.findTool so compiler detection is deterministic instead of
		// probing whatever happens to be installed in the host workspace.
		const stubFindTool = (available: readonly string[]) =>
			vi
				.spyOn(Command, "findTool")
				.mockImplementation((tool: string) =>
					available.includes(tool)
						? { available: true, command: tool, source: "global" }
						: { available: false, command: undefined, source: undefined },
				);

		it("should run typecheck by default", () => {
			TypeScript.clearCache();
			const spy = stubFindTool(["tsc"]);
			try {
				const handler = TypeScript.create();
				const result = handler(["src/index.ts"]);
				expect(result).toHaveLength(1);
				expect((result as string[])[0]).toBe("tsc --noEmit");
			} finally {
				spy.mockRestore();
				TypeScript.clearCache();
			}
		});

		it("should return empty when typecheck is skipped", () => {
			const handler = TypeScript.create({ skipTypecheck: true });
			const result = handler(["src/index.ts"]);
			expect(result).toEqual([]);
		});

		it("should use detected compiler for typecheck command", () => {
			TypeScript.clearCache();
			const spy = stubFindTool(["tsgo", "tsc"]);
			try {
				const cmd = TypeScript.getDefaultTypecheckCommand();
				expect(cmd).toBe("tsgo --noEmit");
			} finally {
				spy.mockRestore();
				TypeScript.clearCache();
			}
		});

		it("should detect tsgo compiler when tsgo is available", () => {
			TypeScript.clearCache();
			const spy = stubFindTool(["tsgo"]);
			try {
				const compiler = TypeScript.detectCompiler();
				expect(compiler).toBe("tsgo");
			} finally {
				spy.mockRestore();
				TypeScript.clearCache();
			}
		});

		it("should fall back to tsc when tsgo is unavailable", () => {
			TypeScript.clearCache();
			const spy = stubFindTool(["tsc"]);
			try {
				const compiler = TypeScript.detectCompiler();
				expect(compiler).toBe("tsc");
			} finally {
				spy.mockRestore();
				TypeScript.clearCache();
			}
		});

		it("should have isAvailable method", () => {
			expect(typeof TypeScript.isAvailable).toBe("function");
			// This repo has TypeScript installed
			expect(TypeScript.isAvailable()).toBe(true);
		});

		it("should return empty when all files are excluded", () => {
			const handler = TypeScript.create({
				exclude: ["src/"],
			});
			const result = handler(["src/index.ts"]);
			expect(result).toEqual([]);
		});

		it("should use cached compiler result on second call", () => {
			TypeScript.clearCache();
			const first = TypeScript.detectCompiler();
			const second = TypeScript.detectCompiler();
			expect(first).toBe(second);
		});
	});
});

describe("Utility classes", () => {
	describe("Filter", () => {
		it("should exclude files matching patterns", () => {
			const files = ["src/index.ts", "dist/index.js", "__fixtures__/test.ts"];
			const result = Filter.exclude(files, ["dist/", "__fixtures__"]);
			expect(result).toEqual(["src/index.ts"]);
		});

		it("should include only files matching patterns", () => {
			const files = ["src/index.ts", "lib/utils.ts", "test/foo.test.ts"];
			const result = Filter.include(files, ["src/", "lib/"]);
			expect(result).toEqual(["src/index.ts", "lib/utils.ts"]);
		});

		it("should apply both include and exclude", () => {
			const files = ["src/index.ts", "src/index.test.ts", "lib/utils.ts"];
			const result = Filter.apply(files, {
				include: ["src/"],
				exclude: [".test."],
			});
			expect(result).toEqual(["src/index.ts"]);
		});

		it("should escape file paths for shell commands", () => {
			const files = ["src/index.ts", "path/with spaces/file.ts"];
			const result = Filter.shellEscape(files);
			expect(result).toBe("'src/index.ts' 'path/with spaces/file.ts'");
		});

		it("should escape single quotes in file paths", () => {
			const files = ["path/with'quote/file.ts"];
			const result = Filter.shellEscape(files);
			expect(result).toBe("'path/with'\\''quote/file.ts'");
		});

		it("should escape special shell characters", () => {
			const files = ["path/$var/file.ts", "path/`cmd`/file.ts", 'path/"quoted"/file.ts', "path/back\\slash/file.ts"];
			const result = Filter.shellEscape(files);
			// Single-quoted strings prevent shell interpretation of $, `, ", and \
			expect(result).toBe(
				"'path/$var/file.ts' 'path/`cmd`/file.ts' 'path/\"quoted\"/file.ts' 'path/back\\slash/file.ts'",
			);
		});

		it("should escape newlines in file paths", () => {
			const files = ["path/with\nnewline/file.ts"];
			const result = Filter.shellEscape(files);
			expect(result).toBe("'path/with\nnewline/file.ts'");
		});

		it("should handle unicode characters", () => {
			const files = ["path/café/file.ts", "path/日本語/file.ts"];
			const result = Filter.shellEscape(files);
			expect(result).toBe("'path/café/file.ts' 'path/日本語/file.ts'");
		});

		it("should handle empty array", () => {
			const result = Filter.shellEscape([]);
			expect(result).toBe("");
		});
	});

	describe("Command", () => {
		it("should detect available commands", () => {
			// 'node' should always be available in test environment
			expect(Command.isAvailable("node")).toBe(true);
		});

		it("should return false for non-existent commands", () => {
			expect(Command.isAvailable("definitely-not-a-real-command-12345")).toBe(false);
		});

		it("should find project root", () => {
			Command.clearCache();
			const root = Command.findRoot();
			// findRoot walks up from cwd to the nearest package.json
			expect(existsSync(join(root, "package.json"))).toBe(true);
		});

		it("should detect package manager from package.json", () => {
			// Clear cache first to ensure fresh detection
			Command.clearCache();
			// This repo uses pnpm
			const pm = Command.detectPackageManager();
			expect(pm).toBe("pnpm");
		});

		it("should return correct exec prefix for each package manager", () => {
			expect(Command.getExecPrefix("npm")).toEqual(["npx", "--no"]);
			expect(Command.getExecPrefix("pnpm")).toEqual(["pnpm", "exec"]);
			expect(Command.getExecPrefix("yarn")).toEqual(["yarn", "exec"]);
			expect(Command.getExecPrefix("bun")).toEqual(["bun", "x", "--no-install"]);
		});

		it("should cache package manager detection", () => {
			Command.clearCache();
			const first = Command.detectPackageManager();
			const second = Command.detectPackageManager();
			expect(first).toBe(second);
		});

		it("should have clearCache method", () => {
			expect(typeof Command.clearCache).toBe("function");
		});

		it("should reject invalid command names", () => {
			// Command injection attempt should throw
			expect(() => Command.isAvailable("node; rm -rf /")).toThrow(/Invalid command name/);
			expect(() => Command.isAvailable("$(whoami)")).toThrow(/Invalid command name/);
			expect(() => Command.isAvailable("node`id`")).toThrow(/Invalid command name/);
		});

		it("should allow valid command names with hyphens", () => {
			// These are valid tool names that should not throw
			expect(() => Command.isAvailable("markdownlint-cli2")).not.toThrow();
			expect(() => Command.isAvailable("sort-package-json")).not.toThrow();
		});
	});

	describe("ConfigDiscovery", () => {
		it("should re-export ConfigDiscovery from silk-effects", () => {
			expect(ConfigDiscovery).toBeDefined();
			expect(ConfigDiscoveryLive).toBeDefined();
		});
	});
});

describe("Configuration utilities", () => {
	describe("createConfig", () => {
		it("should create config with all default handlers", () => {
			const config = createConfig();

			expect(config[PackageJson.glob]).toBeDefined();
			expect(config[Biome.glob]).toBeDefined();
			expect(config[Markdown.glob]).toBeDefined();
			expect(config[Yaml.glob]).toBeDefined();
			expect(config[PnpmWorkspace.glob]).toBeDefined();
			expect(config[ShellScripts.glob]).toBeDefined();
			expect(config[TypeScript.glob]).toBeDefined();
		});

		it("should use array syntax for PackageJson when Biome is enabled", () => {
			const config = createConfig();
			const entry = config[PackageJson.glob];

			// Should be an array with two steps: sort handler + biome handler
			expect(Array.isArray(entry)).toBe(true);
			expect(entry).toHaveLength(2);
		});

		it("should use single handler for PackageJson when Biome is disabled", () => {
			const config = createConfig({ biome: false });
			const entry = config[PackageJson.glob];

			// Should be a single handler function, not an array
			expect(typeof entry).toBe("function");
		});

		it("should use array syntax for PnpmWorkspace when Yaml is enabled", () => {
			const config = createConfig();
			const entry = config[PnpmWorkspace.glob];

			// Should be an array with two steps: sort/format handler + validate handler
			expect(Array.isArray(entry)).toBe(true);
			expect(entry).toHaveLength(2);
		});

		it("should use single handler for PnpmWorkspace when Yaml is disabled", () => {
			const config = createConfig({ yaml: false });
			const entry = config[PnpmWorkspace.glob];

			// Should be a single handler function, not an array
			expect(typeof entry).toBe("function");
		});

		it("should use array syntax for Yaml with format command and validation", () => {
			const config = createConfig({ pnpmWorkspace: false });
			const entry = config[Yaml.glob];

			// Should be an array with two steps: format command + validate handler
			expect(Array.isArray(entry)).toBe(true);
			expect(entry).toHaveLength(2);
		});

		it("should allow disabling handlers", () => {
			const config = createConfig({
				packageJson: false,
				biome: false,
				markdown: false,
			});

			expect(config[PackageJson.glob]).toBeUndefined();
			expect(config[Biome.glob]).toBeUndefined();
			expect(config[Markdown.glob]).toBeUndefined();
			// Others should still be present
			expect(config[Yaml.glob]).toBeDefined();
		});

		it("should pass options to handlers", () => {
			const config = createConfig({
				biome: { exclude: ["custom/"] },
			});

			const handler = config[Biome.glob];
			expect(typeof handler).toBe("function");

			// Test that the custom exclude is applied
			const result = (handler as (f: readonly string[]) => string)(["src/index.ts", "custom/file.ts"]);
			// ConfigSearch finds biome.jsonc in this repo, so --config flag is included
			expect(result).toContain("biome check --write --no-errors-on-unmatched");
			expect(result).toContain("src/index.ts");
			expect(result).not.toContain("custom/file.ts");
		});

		it("should include custom handlers", () => {
			const customHandler = (files: readonly string[]): string => `custom-tool ${files.join(" ")}`;
			const config = createConfig({
				custom: {
					"*.css": customHandler,
				},
			});

			expect(config["*.css"]).toBe(customHandler);
		});
	});

	describe("Preset", () => {
		describe("minimal", () => {
			it("should include only PackageJson and Biome", () => {
				const config = Preset.minimal();

				expect(config[PackageJson.glob]).toBeDefined();
				expect(config[Biome.glob]).toBeDefined();
				expect(config[Markdown.glob]).toBeUndefined();
				expect(config[Yaml.glob]).toBeUndefined();
				expect(config[TypeScript.glob]).toBeUndefined();
			});

			it("should allow extending with custom options", () => {
				const config = Preset.minimal({
					biome: { exclude: ["vendor/"] },
				});

				expect(config[Biome.glob]).toBeDefined();
			});

			it("should allow enabling additional handlers", () => {
				const config = Preset.minimal({
					markdown: {}, // Enable markdown
				});

				expect(config[Markdown.glob]).toBeDefined();
			});
		});

		describe("standard", () => {
			it("should include formatting and linting handlers", () => {
				const config = Preset.standard();

				expect(config[PackageJson.glob]).toBeDefined();
				expect(config[Biome.glob]).toBeDefined();
				expect(config[Markdown.glob]).toBeDefined();
				expect(config[Yaml.glob]).toBeDefined();
				expect(config[PnpmWorkspace.glob]).toBeDefined();
				expect(config[ShellScripts.glob]).toBeDefined();
				// TypeScript is disabled in standard preset
				expect(config[TypeScript.glob]).toBeUndefined();
			});

			it("should allow extending with options", () => {
				const config = Preset.standard({
					biome: { exclude: ["legacy/"] },
					typescript: {}, // Enable typescript
				});

				expect(config[Biome.glob]).toBeDefined();
				expect(config[TypeScript.glob]).toBeDefined();
			});
		});

		describe("silk", () => {
			it("should include all handlers", () => {
				const config = Preset.silk();

				expect(config[PackageJson.glob]).toBeDefined();
				expect(config[Biome.glob]).toBeDefined();
				expect(config[Markdown.glob]).toBeDefined();
				expect(config[Yaml.glob]).toBeDefined();
				expect(config[PnpmWorkspace.glob]).toBeDefined();
				expect(config[ShellScripts.glob]).toBeDefined();
				expect(config[TypeScript.glob]).toBeDefined();
			});

			it("should allow customizing handlers", () => {
				const config = Preset.silk({
					typescript: { skipTypecheck: true },
				});

				expect(config[TypeScript.glob]).toBeDefined();
			});
		});

		describe("get", () => {
			it("should return minimal preset by name", () => {
				const config = Preset.get("minimal");
				expect(config[Markdown.glob]).toBeUndefined();
			});

			it("should return standard preset by name", () => {
				const config = Preset.get("standard");
				expect(config[Markdown.glob]).toBeDefined();
				expect(config[TypeScript.glob]).toBeUndefined();
			});

			it("should return silk preset by name", () => {
				const config = Preset.get("silk");
				expect(config[TypeScript.glob]).toBeDefined();
			});

			it("should allow extending presets via get", () => {
				const config = Preset.get("standard", {
					typescript: {},
				});
				expect(config[TypeScript.glob]).toBeDefined();
			});
		});
	});
});

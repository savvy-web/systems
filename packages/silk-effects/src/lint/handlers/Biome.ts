/**
 * Handler for JavaScript/TypeScript/JSON files.
 *
 * Formats and lints with Biome.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BiomeOptions, LintStagedHandler } from "../types.js";
import { Command } from "../utils/Command.js";
import { Filter } from "../utils/Filter.js";
import { getWorkspacePackagePaths, getWorkspaceRoot } from "../utils/Workspace.js";

/**
 * Handler for JavaScript, TypeScript, and JSON files.
 *
 * Formats and lints with Biome.
 *
 * Biome discovery order:
 * 1. Global `biome` command (preferred)
 * 2. Local installation via `pnpm exec biome`
 * 3. Local installation via `npx biome`
 *
 * Config file discovery:
 * - Searches the workspace root for `biome.jsonc` or `biome.json`.
 * - Falls back to CWD when not in a workspace.
 * - No `lib/configs/` convention — biome configs live at workspace roots only.
 *
 * @throws Error if Biome is not available (globally or locally)
 *
 * @example
 * ```typescript
 * import { Biome } from '@savvy-web/lint-staged';
 *
 * export default {
 *   // Auto-discovers biome command and config file
 *   [Biome.glob]: Biome.handler,
 *
 *   // Or with custom excludes
 *   [Biome.glob]: Biome.create({
 *     exclude: ['vendor/', 'generated/'],
 *   }),
 * };
 * ```
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern for TSDoc discoverability
export class Biome {
	/**
	 * Glob pattern for matching JavaScript/TypeScript/JSON files.
	 * @defaultValue `'*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}'`
	 */
	static readonly glob = "*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}";

	/**
	 * Default patterns to exclude from processing.
	 * Excludes package.json since PackageJson handler processes those files.
	 * @defaultValue `['package.json', 'package-lock.json', '__fixtures__', '__test__/fixtures']`
	 */
	static readonly defaultExcludes = ["package.json", "package-lock.json", "__fixtures__", "__test__/fixtures"] as const;

	/** Candidate config file names in preference order. */
	private static readonly CONFIG_NAMES = ["biome.jsonc", "biome.json"] as const;

	/**
	 * Pre-configured handler with default options.
	 * Auto-discovers biome command and config file location.
	 */
	static readonly handler: LintStagedHandler = Biome.create();

	/**
	 * Find the Biome executable.
	 *
	 * Searches in order:
	 * 1. Global `biome` command
	 * 2. `pnpm exec biome`
	 * 3. `npx biome`
	 *
	 * @returns The command to run biome, or undefined if not found
	 */
	static findBiome(): string | undefined {
		const result = Command.findTool("biome");
		return result.command;
	}

	/**
	 * Check if Biome is available.
	 *
	 * @returns `true` if biome is available globally or locally
	 */
	static isAvailable(): boolean {
		return Command.findTool("biome").available;
	}

	/**
	 * Find the Biome config file at the workspace root.
	 *
	 * @remarks
	 * Searches the workspace root directory for `biome.jsonc` then `biome.json`.
	 * Falls back to CWD when not running inside a workspace. The `lib/configs/`
	 * convention is not used — biome configs are expected at workspace roots only.
	 *
	 * @returns Absolute path to the config file, or undefined if not found
	 */
	static findConfig(): string | undefined {
		const root = getWorkspaceRoot();
		const searchDir = root ?? process.cwd();

		for (const name of Biome.CONFIG_NAMES) {
			const fullPath = join(searchDir, name);
			if (existsSync(fullPath)) return fullPath;
		}
		return undefined;
	}

	/**
	 * Find all Biome config files across workspace roots.
	 *
	 * @remarks
	 * Searches the workspace root and each leaf workspace root for a
	 * `biome.jsonc` or `biome.json` config file. At most one config is
	 * collected per directory (the first match in preference order).
	 * Falls back to CWD when not running inside a workspace.
	 *
	 * This method is intended for the CLI check command, which validates
	 * `$schema` URLs across all workspace biome configs.
	 *
	 * @returns Array of absolute config file paths (may be empty)
	 */
	static findAllConfigs(): string[] {
		const root = getWorkspaceRoot();
		const configs: string[] = [];

		if (root === null) {
			// Fallback: check CWD with absolute paths
			const cwd = process.cwd();
			for (const name of Biome.CONFIG_NAMES) {
				const fullPath = join(cwd, name);
				if (existsSync(fullPath)) {
					configs.push(fullPath);
					break;
				}
			}
			return configs;
		}

		// Check workspace root
		for (const name of Biome.CONFIG_NAMES) {
			const fullPath = join(root, name);
			if (existsSync(fullPath)) {
				configs.push(fullPath);
				break;
			}
		}

		// Check each leaf workspace root
		for (const pkgPath of getWorkspacePackagePaths()) {
			for (const name of Biome.CONFIG_NAMES) {
				const fullPath = join(pkgPath, name);
				if (existsSync(fullPath)) {
					configs.push(fullPath);
					break;
				}
			}
		}

		return configs;
	}

	/**
	 * Create a handler with custom options.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 * @throws Error if Biome is not available when handler is invoked
	 */
	static create(options: BiomeOptions = {}): LintStagedHandler {
		const excludes = options.exclude ?? [...Biome.defaultExcludes];

		// Resolve config: explicit > auto-discovered
		const config = options.config ?? Biome.findConfig();

		return (filenames: readonly string[]): string | string[] => {
			const filtered = Filter.exclude(filenames, excludes);

			if (filtered.length === 0) {
				return [];
			}

			// Find biome - throw if not available
			const biomeCmd = Command.requireTool(
				"biome",
				"Biome is not available. Install it globally (recommended) or add @biomejs/biome as a dev dependency.",
			);

			const files = Filter.shellEscape(filtered);
			const flags = options.flags ?? [];
			const configFlag = config ? `--config-path=${config}` : "";

			const cmd = [`${biomeCmd} check --write --no-errors-on-unmatched`, configFlag, ...flags, files]
				.filter(Boolean)
				.join(" ");

			return cmd;
		};
	}
}

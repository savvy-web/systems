/**
 * Handler for pnpm-workspace.yaml.
 *
 * Sorts, formats, and validates pnpm-workspace.yaml using bundled libraries.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import type { LintStagedHandler, PnpmWorkspaceOptions } from "../types.js";
import { Command } from "../utils/Command.js";

/**
 * Shape of pnpm-workspace.yaml content.
 */
export interface PnpmWorkspaceContent {
	packages?: string[];
	onlyBuiltDependencies?: string[];
	publicHoistPattern?: string[];
	[key: string]: unknown;
}

/**
 * Default YAML stringify options for consistent formatting.
 */
const DEFAULT_STRINGIFY_OPTIONS = {
	indent: 2,
	lineWidth: 0, // Disable line wrapping
	singleQuote: false,
} as const;

/**
 * Handler for pnpm-workspace.yaml.
 *
 * Sorts, formats, and validates pnpm-workspace.yaml using bundled libraries.
 *
 * @remarks
 * This handler processes the workspace file entirely in JavaScript:
 * - Sorts the `packages` array alphabetically (if present)
 * - Sorts `onlyBuiltDependencies` and `publicHoistPattern` arrays (if present)
 * - Sorts all top-level keys alphabetically, keeping `packages` first
 * - Formats the output with consistent YAML styling
 * - Validates the YAML structure
 *
 * @example
 * ```typescript
 * import { PnpmWorkspace } from '\@savvy-web/lint-staged';
 *
 * export default {
 *   [PnpmWorkspace.glob]: PnpmWorkspace.create({
 *     skipSort: true, // Skip sorting
 *   }),
 * };
 * ```
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern for TSDoc discoverability
export class PnpmWorkspace {
	/**
	 * Glob pattern for matching pnpm-workspace.yaml.
	 * @defaultValue `'pnpm-workspace.yaml'`
	 */
	static readonly glob = "pnpm-workspace.yaml";

	/**
	 * Default patterns to exclude (none, since this is a single file).
	 * @defaultValue `[]`
	 */
	static readonly defaultExcludes = [] as const;

	/**
	 * Pre-configured handler with default options.
	 */
	static readonly handler: LintStagedHandler = PnpmWorkspace.create();

	/**
	 * Keys whose array values should be sorted alphabetically.
	 */
	private static readonly SORTABLE_ARRAY_KEYS = new Set(["packages", "onlyBuiltDependencies", "publicHoistPattern"]);

	/**
	 * Sort the pnpm-workspace.yaml content.
	 *
	 * Sorts:
	 * - `packages` array alphabetically
	 * - `onlyBuiltDependencies` array (if present)
	 * - `publicHoistPattern` array (if present)
	 * - All keys alphabetically, keeping `packages` first
	 *
	 * @param content - Parsed pnpm-workspace.yaml content
	 * @returns Sorted content
	 */
	static sortContent(content: PnpmWorkspaceContent): PnpmWorkspaceContent {
		const result: PnpmWorkspaceContent = {};

		// Get all keys and sort them, but keep 'packages' first
		const keys = Object.keys(content).sort((a, b) => {
			if (a === "packages") return -1;
			if (b === "packages") return 1;
			return a.localeCompare(b);
		});

		for (const key of keys) {
			const value = content[key];

			// Sort array values for known sortable keys
			if (PnpmWorkspace.SORTABLE_ARRAY_KEYS.has(key) && Array.isArray(value)) {
				result[key] = [...value].sort();
			} else {
				result[key] = value;
			}
		}

		return result;
	}

	/**
	 * Create a handler that returns a CLI command to sort/format pnpm-workspace.yaml.
	 *
	 * @remarks
	 * Unlike {@link create}, this does not modify files in the handler function
	 * body. Instead it returns a `savvy-lint fmt pnpm-workspace` command so
	 * lint-staged can detect the modification and auto-stage it.
	 * Use this in lint-staged array syntax for sequential execution.
	 *
	 * @returns A lint-staged compatible handler function
	 */
	static fmtCommand(): LintStagedHandler {
		return (): string | string[] => {
			if (!existsSync("pnpm-workspace.yaml")) {
				return [];
			}
			const cmd = Command.findSavvyLint();
			return `${cmd} fmt pnpm-workspace`;
		};
	}

	/**
	 * Create a handler with custom options.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	static create(options: PnpmWorkspaceOptions = {}): LintStagedHandler {
		const skipSort = options.skipSort ?? false;
		const skipFormat = options.skipFormat ?? false;
		const skipLint = options.skipLint ?? false;

		return (): string | string[] => {
			const filepath = "pnpm-workspace.yaml";

			// If the file doesn't exist, nothing to do
			if (!existsSync(filepath)) {
				return [];
			}

			// Read and parse the file
			const content = readFileSync(filepath, "utf-8");
			let parsed: PnpmWorkspaceContent;

			try {
				parsed = parse(content) as PnpmWorkspaceContent;
			} catch (error) {
				if (!skipLint) {
					throw new Error(`Invalid YAML in ${filepath}: ${error instanceof Error ? error.message : String(error)}`);
				}
				// If skipLint and parsing failed, we can't continue
				return [];
			}

			// Sort if not skipped
			if (!skipSort) {
				parsed = PnpmWorkspace.sortContent(parsed);
			}

			// Format and write back (unless both sort and format are skipped)
			if (!skipSort || !skipFormat) {
				const formatted = stringify(parsed, DEFAULT_STRINGIFY_OPTIONS);
				writeFileSync(filepath, formatted, "utf-8");

				return [];
			}

			return [];
		};
	}
}

/**
 * Handler for package.json files.
 *
 * Sorts fields with sort-package-json and formats with Biome.
 */

import { readFileSync, writeFileSync } from "node:fs";
import sortPackageJson from "sort-package-json";
import type { LintStagedHandler, PackageJsonOptions } from "../types.js";
import { Command } from "../utils/Command.js";
import { Filter } from "../utils/Filter.js";
import { isWorkspacePackagePath } from "../utils/Workspace.js";

/**
 * Handler for package.json files.
 *
 * Sorts fields with sort-package-json and formats with Biome.
 *
 * @example
 * ```typescript
 * import { PackageJson } from '@savvy-web/lint-staged';
 *
 * export default {
 *   // Use defaults
 *   [PackageJson.glob]: PackageJson.handler,
 *
 *   // Or customize
 *   [PackageJson.glob]: PackageJson.create({
 *     exclude: ['packages/legacy/package.json'],
 *     skipSort: true,
 *   }),
 * };
 * ```
 */
export class PackageJson {
	/**
	 * Glob pattern for matching package.json files.
	 * @defaultValue `'**\/package.json'`
	 */
	static readonly glob = "**/package.json";

	/**
	 * Default patterns to exclude from processing.
	 * @defaultValue `['dist/package.json', '__fixtures__']`
	 */
	static readonly defaultExcludes = ["dist/package.json", "__fixtures__"] as const;

	/**
	 * Pre-configured handler with default options.
	 */
	static readonly handler: LintStagedHandler = PackageJson.create();

	/**
	 * Filter filenames to workspace roots only.
	 *
	 * @remarks
	 * Applies exclude patterns first (for backward compatibility with custom
	 * excludes), then filters to workspace root and leaf workspace roots only.
	 * Falls back permissively when not in a workspace.
	 *
	 * @param filenames - Incoming file list from lint-staged
	 * @param excludes - Patterns to exclude before workspace filtering
	 * @returns Filtered list of files at workspace roots
	 */
	private static filterToWorkspaceRoots(filenames: readonly string[], excludes: readonly string[]): string[] {
		const excluded = Filter.exclude(filenames, [...excludes]);
		return excluded.filter((f) => isWorkspacePackagePath(f));
	}

	/**
	 * Create a handler with custom options.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	/**
	 * Create a handler that returns a CLI command to sort package.json files.
	 *
	 * @remarks
	 * Unlike {@link create}, this does not modify files in the handler function
	 * body. Instead it returns a `savvy-lint fmt package-json` command so
	 * lint-staged can detect the modification and auto-stage it.
	 * Use this in lint-staged array syntax for sequential execution.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	static fmtCommand(options: PackageJsonOptions = {}): LintStagedHandler {
		const excludes = options.exclude ?? [...PackageJson.defaultExcludes];

		return (filenames: readonly string[]): string | string[] => {
			const filtered = PackageJson.filterToWorkspaceRoots(filenames, excludes);

			if (filtered.length === 0) {
				return [];
			}

			const cmd = Command.findSavvyLint();
			return `${cmd} fmt package-json ${Filter.shellEscape(filtered)}`;
		};
	}

	/**
	 * Sort the keys of a package.json document string.
	 *
	 * @remarks
	 * Pure transform over the file contents using `sort-package-json`. Used by
	 * the `savvy lint fmt package-json` subcommand so the CLI does not depend on
	 * `sort-package-json` directly.
	 *
	 * @param content - The raw package.json file contents
	 * @returns The sorted package.json file contents
	 */
	static sortContent(content: string): string {
		return sortPackageJson(content);
	}

	/**
	 * Create a handler with custom options.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	static create(options: PackageJsonOptions = {}): LintStagedHandler {
		const excludes = options.exclude ?? [...PackageJson.defaultExcludes];
		const skipSort = options.skipSort ?? false;
		const skipFormat = options.skipFormat ?? false;

		return (filenames: readonly string[]): string | string[] => {
			const filtered = PackageJson.filterToWorkspaceRoots(filenames, excludes);

			if (filtered.length === 0) {
				return [];
			}

			// Sort package.json files in-place using the bundled library
			if (!skipSort) {
				for (const filepath of filtered) {
					const content = readFileSync(filepath, "utf-8");
					const sorted = sortPackageJson(content);
					if (sorted !== content) {
						writeFileSync(filepath, sorted, "utf-8");
					}
				}
			}

			// When skipFormat is true, only sort — no biome command
			if (skipFormat) {
				return [];
			}

			// Build Biome formatting command with properly escaped file paths
			const files = Filter.shellEscape(filtered);
			const biomeCmd = options.biomeConfig
				? `biome check --write --max-diagnostics=none --config-path=${options.biomeConfig} ${files}`
				: `biome check --write --max-diagnostics=none ${files}`;

			return biomeCmd;
		};
	}
}

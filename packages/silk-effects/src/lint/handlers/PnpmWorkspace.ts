/**
 * Handler for pnpm-workspace.yaml.
 *
 * Sorts, formats, and validates pnpm-workspace.yaml using bundled libraries.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Yaml as EffectedYaml, YamlStringifyOptions } from "@effected/yaml";
import { Effect, Result } from "effect";
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
 *
 * @remarks
 * `lineWidth: 0` disables line wrapping, `indentSequences: true` indents block
 * sequences one level under their key, and `quoteStyle: "double"` selects the
 * quote character for plain scalars that require quoting. Together these
 * reproduce the v3 `yaml.stringify(..., { indent: 2, lineWidth: 0,
 * singleQuote: false })` byte format directly — probed byte-identical to the
 * previous Prettier-normalized output on this repo's real
 * `pnpm-workspace.yaml` and on hostile synthetic shapes (scoped package keys,
 * block scalars, nested sequences of maps), which is what let the Prettier
 * post-process be removed.
 */
const DEFAULT_STRINGIFY_OPTIONS = new YamlStringifyOptions({
	indent: 2,
	lineWidth: 0, // Disable line wrapping
	indentSequences: true,
	quoteStyle: "double",
});

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
 * import { PnpmWorkspace } from '\@savvy-web/silk/lint';
 *
 * export default {
 *   [PnpmWorkspace.glob]: PnpmWorkspace.create({
 *     skipSort: true, // Skip sorting
 *   }),
 * };
 * ```
 */
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
	 * Stringify sorted workspace content to the repo's canonical YAML byte format.
	 *
	 * @remarks
	 * The single source of truth for pnpm-workspace.yaml formatting. Both
	 * {@link create} and the `savvy lint fmt pnpm-workspace` CLI subcommand route
	 * through here so the two paths cannot drift.
	 *
	 * {@link DEFAULT_STRINGIFY_OPTIONS} produces the repo's byte format directly.
	 * The former Prettier post-process — which existed only to re-indent block
	 * sequences and re-quote scalars — is gone: `indentSequences` and
	 * `quoteStyle` now express both, so there is no second printer to drift from.
	 *
	 * Still `async` for source compatibility with existing callers; it performs
	 * no asynchronous work and can become synchronous in the next major.
	 *
	 * @param content - Sorted pnpm-workspace.yaml content
	 * @returns The formatted YAML source
	 */
	static async formatContent(content: PnpmWorkspaceContent): Promise<string> {
		return Effect.runSync(EffectedYaml.stringify(content, DEFAULT_STRINGIFY_OPTIONS));
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

		return async (): Promise<string | string[]> => {
			const filepath = "pnpm-workspace.yaml";

			// If the file doesn't exist, nothing to do
			if (!existsSync(filepath)) {
				return [];
			}

			// Read and parse the file
			const content = readFileSync(filepath, "utf-8");
			const parseResult = Effect.runSync(Effect.result(EffectedYaml.parse(content)));
			if (Result.isFailure(parseResult)) {
				if (!skipLint) {
					throw new Error(`Invalid YAML in ${filepath}: ${parseResult.failure.message}`);
				}
				// If skipLint and parsing failed, we can't continue
				return [];
			}
			let parsed = parseResult.success as PnpmWorkspaceContent;

			// Sort if not skipped
			if (!skipSort) {
				parsed = PnpmWorkspace.sortContent(parsed);
			}

			// Format and write back (unless both sort and format are skipped)
			if (!skipSort || !skipFormat) {
				const formatted = await PnpmWorkspace.formatContent(parsed);
				writeFileSync(filepath, formatted, "utf-8");

				return [];
			}

			return [];
		};
	}
}

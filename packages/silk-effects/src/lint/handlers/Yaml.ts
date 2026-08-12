/**
 * Handler for YAML files.
 *
 * Formats and validates with `@effected/yaml`, a bundled dependency.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Yaml as KitYaml, YamlFormat, YamlFormattingOptions } from "@effected/yaml";
import type { LintStagedHandler, YamlOptions } from "../types.js";
import { Command } from "../utils/Command.js";
import { Filter } from "../utils/Filter.js";

/**
 * Handler for YAML files.
 *
 * Formats and validates with `@effected/yaml`, a bundled dependency.
 *
 * @remarks
 * Excludes pnpm-lock.yaml and pnpm-workspace.yaml by default.
 * pnpm-workspace.yaml has its own dedicated handler.
 *
 * Formatting preserves comments and blank lines, and formats every document of
 * a multi-document stream. Validation covers the WHOLE stream: a file whose
 * second document is invalid fails, which a single-document parse would miss.
 *
 * @example
 * ```typescript
 * import { Yaml } from '\@savvy-web/silk/lint';
 *
 * export default {
 *   [Yaml.glob]: Yaml.create({
 *     exclude: ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'generated/'],
 *   }),
 * };
 * ```
 */
export class Yaml {
	/**
	 * Glob pattern for matching YAML files.
	 * @defaultValue `'**\/*.{yml,yaml}'`
	 */
	static readonly glob = "**/*.{yml,yaml}";

	/**
	 * Default patterns to exclude from processing.
	 * @defaultValue `['pnpm-lock.yaml', 'pnpm-workspace.yaml', '__test__/fixtures']`
	 */
	static readonly defaultExcludes = ["pnpm-lock.yaml", "pnpm-workspace.yaml", "__test__/fixtures"] as const;

	/**
	 * The formatting options applied when a caller supplies none.
	 *
	 * @remarks
	 * `indentSequences` matches the block-sequence indentation an ex-Prettier
	 * repository already has on disk; without it, formatting rewrites every
	 * sequence in the tree. `quoteStyle` only governs scalars the stringifier
	 * creates — it never re-quotes scalars already present in the source — so it
	 * is set for consistency with `PnpmWorkspace`, not to change existing files.
	 */
	static readonly defaultFormatOptions: YamlFormattingOptions = YamlFormattingOptions.make({
		quoteStyle: "double",
		indentSequences: true,
	});

	/**
	 * Pre-configured handler with default options.
	 */
	static readonly handler: LintStagedHandler = Yaml.create();

	/**
	 * Check if the YAML engine is available.
	 *
	 * @returns Always `true` since `@effected/yaml` is a bundled dependency
	 */
	static isAvailable(): boolean {
		return true;
	}

	/**
	 * Format a YAML file in-place.
	 *
	 * @remarks
	 * Synchronous by contract: the engine is a pure, IO-free tier, so the only
	 * IO here is this function's own file read and write.
	 *
	 * @param filepath - Path to the YAML file
	 * @param options - Formatting options; defaults to {@link Yaml.defaultFormatOptions}
	 */
	static formatFile(filepath: string, options: YamlFormattingOptions = Yaml.defaultFormatOptions): void {
		const content = readFileSync(filepath, "utf-8");
		const formatted = YamlFormat.formatToString(content, undefined, options);
		if (formatted !== content) {
			writeFileSync(filepath, formatted, "utf-8");
		}
	}

	/**
	 * Validate a YAML file.
	 *
	 * @remarks
	 * Validates every document of the stream, so a multi-document file whose
	 * later documents are invalid is rejected rather than silently accepted.
	 *
	 * @param filepath - Path to the YAML file
	 * @throws Error if the YAML is invalid
	 */
	static validateFile(filepath: string): void {
		const content = readFileSync(filepath, "utf-8");
		const result = KitYaml.parseAllResult(content);
		if (!("success" in result)) {
			throw new Error(String(result.failure));
		}
	}

	/**
	 * Serialize formatting options for the `savvy lint fmt yaml --format` flag.
	 *
	 * @remarks
	 * The CLI subcommand runs in a separate process, so options set on
	 * {@link fmtCommand} have to cross a shell boundary to reach
	 * {@link formatFile}. Without that hop the two entry points format the same
	 * file differently — the drift this package's shared-static rule exists to
	 * prevent. {@link parseFormatOptions} is the inverse.
	 *
	 * @param options - Formatting options to encode
	 * @returns The options as a JSON string
	 */
	static encodeFormatOptions(options: YamlFormattingOptions): string {
		return JSON.stringify(options);
	}

	/**
	 * Parse formatting options serialized by {@link encodeFormatOptions}.
	 *
	 * @param encoded - JSON produced by {@link encodeFormatOptions}
	 * @returns The decoded options
	 * @throws Error if the JSON is malformed or fails schema validation
	 */
	static parseFormatOptions(encoded: string): YamlFormattingOptions {
		return YamlFormattingOptions.make(JSON.parse(encoded) as Parameters<typeof YamlFormattingOptions.make>[0]);
	}

	/**
	 * Create a handler that returns a CLI command to format YAML files.
	 *
	 * @remarks
	 * Unlike {@link create}, this does not modify files in the handler function
	 * body. Instead it returns a `savvy-lint fmt yaml` command so lint-staged
	 * can detect the modification and auto-stage it.
	 * Use this in lint-staged array syntax for sequential execution.
	 *
	 * `options.format` is forwarded to the subcommand as `--format`, so this
	 * path and {@link create} produce identical bytes for the same options.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	static fmtCommand(options: YamlOptions = {}): LintStagedHandler {
		const excludes = options.exclude ?? [...Yaml.defaultExcludes];
		const formatOptions = options.format;

		return (filenames: readonly string[]): string | string[] => {
			const filtered = Filter.exclude(filenames, excludes);

			if (filtered.length === 0) {
				return [];
			}

			const cmd = Command.findSavvyLint();
			const formatFlag = formatOptions
				? ` --format ${Filter.shellEscape([Yaml.encodeFormatOptions(formatOptions)])}`
				: "";
			return `${cmd} fmt yaml${formatFlag} ${Filter.shellEscape(filtered)}`;
		};
	}

	/**
	 * Create a handler with custom options.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	static create(options: YamlOptions = {}): LintStagedHandler {
		const excludes = options.exclude ?? [...Yaml.defaultExcludes];
		const skipFormat = options.skipFormat ?? false;
		const skipValidate = options.skipValidate ?? false;
		const formatOptions = options.format ?? Yaml.defaultFormatOptions;

		return (filenames: readonly string[]): string | string[] => {
			const filtered = Filter.exclude(filenames, excludes);

			if (filtered.length === 0) {
				return [];
			}

			// Format first, then validate.
			if (!skipFormat) {
				for (const filepath of filtered) {
					Yaml.formatFile(filepath, formatOptions);
				}
			}

			if (!skipValidate) {
				for (const filepath of filtered) {
					try {
						Yaml.validateFile(filepath);
					} catch (error) {
						throw new Error(`Invalid YAML in ${filepath}: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
			}

			return [];
		};
	}
}

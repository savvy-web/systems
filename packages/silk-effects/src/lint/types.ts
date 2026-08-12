// Type definitions for @savvy-web/lint-staged.

import type { YamlFormattingOptions } from "@effected/yaml";

/**
 * A lint-staged handler function.
 * Receives an array of staged filenames and returns command(s) to execute.
 * Uses `readonly string[]` to match lint-staged's type signature.
 */
export type LintStagedHandler = (filenames: readonly string[]) => string | string[] | Promise<string | string[]>;

/**
 * A single lint-staged command entry: a handler function, a string command, or an array of strings.
 */
export type LintStagedEntry = LintStagedHandler | string | string[];

/**
 * A lint-staged configuration object.
 * Maps glob patterns to handlers, commands, or arrays of sequential steps.
 *
 * @remarks
 * When a value is an array of functions/strings, lint-staged runs each element
 * sequentially with proper staging between steps.
 */
export type LintStagedConfig = Record<string, LintStagedEntry | LintStagedEntry[]>;

/**
 * Base options shared by all handlers.
 */
export interface BaseHandlerOptions {
	/**
	 * Patterns to exclude from processing.
	 * Uses `string.includes()` for matching.
	 */
	exclude?: string[];
}

/**
 * Options for the PackageJson handler.
 */
export interface PackageJsonOptions extends BaseHandlerOptions {
	/**
	 * Skip sort-package-json, only run Biome formatting.
	 * @defaultValue false
	 */
	skipSort?: boolean;

	/**
	 * Skip Biome formatting (sort only).
	 * @defaultValue false
	 */
	skipFormat?: boolean;

	/**
	 * Path to Biome config file.
	 */
	biomeConfig?: string;
}

/**
 * Options for the Biome handler.
 */
export interface BiomeOptions extends BaseHandlerOptions {
	/**
	 * Path to Biome config file.
	 */
	config?: string;

	/**
	 * Additional Biome CLI flags.
	 */
	flags?: string[];
}

/**
 * Options for the Markdown handler.
 */
export interface MarkdownOptions extends BaseHandlerOptions {
	/**
	 * Path to markdownlint-cli2 config file.
	 * @defaultValue './lib/configs/.markdownlint-cli2.jsonc'
	 */
	config?: string;

	/**
	 * Disable auto-fix (lint only).
	 * @defaultValue false
	 */
	noFix?: boolean;
}

/**
 * Options for the PnpmWorkspace handler.
 */
export interface PnpmWorkspaceOptions {
	/**
	 * Skip sorting packages and keys.
	 * @defaultValue false
	 */
	skipSort?: boolean;

	/**
	 * Skip YAML formatting.
	 * @defaultValue false
	 */
	skipFormat?: boolean;

	/**
	 * Skip YAML validation.
	 * @defaultValue false
	 */
	skipLint?: boolean;
}

/**
 * Options for the ShellScripts handler.
 */
export interface ShellScriptsOptions extends BaseHandlerOptions {
	/**
	 * Set executable bit instead of removing it.
	 * @defaultValue false
	 */
	makeExecutable?: boolean;
}

/**
 * Options for the Yaml handler.
 */
export interface YamlOptions extends BaseHandlerOptions {
	/**
	 * Formatting options passed through to `@effected/yaml`.
	 *
	 * @remarks
	 * Defaults to the handler's own `defaultFormatOptions`. There is no
	 * config-file discovery: `@effected/yaml` is a pure tier that loads nothing
	 * from disk, and a consumer's `.prettierrc` is NOT consulted.
	 */
	format?: YamlFormattingOptions;

	/**
	 * Skip YAML formatting.
	 * @defaultValue false
	 */
	skipFormat?: boolean;

	/**
	 * Skip YAML validation.
	 * @defaultValue false
	 */
	skipValidate?: boolean;
}

/**
 * Options for the TypeScript handler.
 */
export interface TypeScriptOptions extends BaseHandlerOptions {
	/**
	 * Skip type checking.
	 * @defaultValue false
	 */
	skipTypecheck?: boolean;

	/**
	 * Command for type checking.
	 * @defaultValue Auto-detected
	 */
	typecheckCommand?: string;
}

/**
 * Options for createConfig() helper.
 */
export interface CreateConfigOptions {
	/**
	 * Options for PackageJson handler, or false to disable.
	 */
	packageJson?: PackageJsonOptions | false;

	/**
	 * Options for Biome handler, or false to disable.
	 */
	biome?: BiomeOptions | false;

	/**
	 * Options for Markdown handler, or false to disable.
	 */
	markdown?: MarkdownOptions | false;

	/**
	 * Options for PnpmWorkspace handler, or false to disable.
	 */
	pnpmWorkspace?: PnpmWorkspaceOptions | false;

	/**
	 * Options for ShellScripts handler, or false to disable.
	 */
	shellScripts?: ShellScriptsOptions | false;

	/**
	 * Options for Yaml handler, or false to disable.
	 */
	yaml?: YamlOptions | false;

	/**
	 * Options for TypeScript handler, or false to disable.
	 */
	typescript?: TypeScriptOptions | false;

	/**
	 * Custom handlers to add to the configuration.
	 */
	custom?: LintStagedConfig;
}

/**
 * Preset type for standard configurations.
 */
export type PresetType = "minimal" | "standard" | "silk";

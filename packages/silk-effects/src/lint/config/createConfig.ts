/**
 * Configuration factory for generating complete lint-staged configurations.
 */

import { Biome } from "../handlers/Biome.js";
import { Markdown } from "../handlers/Markdown.js";
import { PackageJson } from "../handlers/PackageJson.js";
import { PnpmWorkspace } from "../handlers/PnpmWorkspace.js";
import { ShellScripts } from "../handlers/ShellScripts.js";
import { TypeScript } from "../handlers/TypeScript.js";
import { Yaml } from "../handlers/Yaml.js";
import type { CreateConfigOptions, LintStagedConfig } from "../types.js";

/**
 * Create a complete lint-staged configuration with all handlers.
 *
 * @param options - Configuration options for each handler
 * @returns A lint-staged compatible configuration object
 *
 * @example
 * ```typescript
 * import { createConfig } from '@savvy-web/lint-staged';
 *
 * // Use all defaults
 * export default createConfig();
 *
 * // Customize specific handlers
 * export default createConfig({
 *   packageJson: { skipSort: true },
 *   biome: { exclude: ['vendor/'] },
 *   custom: {
 *     '*.css': (files) => `stylelint ${files.join(' ')}`,
 *   },
 * });
 * ```
 */
export function createConfig(options: CreateConfigOptions = {}): LintStagedConfig {
	const config: LintStagedConfig = {};

	const pkgJsonEnabled = options.packageJson !== false;
	const biomeEnabled = options.biome !== false;

	// PackageJson + Biome: use array syntax for sequential execution
	// Step 1: sort via CLI command (auto-staged), Step 2: biome format
	if (pkgJsonEnabled && biomeEnabled) {
		const pkgOpts = typeof options.packageJson === "object" ? options.packageJson : {};
		const biomeOpts = typeof options.biome === "object" ? options.biome : {};

		config[PackageJson.glob] = [
			PackageJson.fmtCommand(pkgOpts),
			Biome.create({
				...biomeOpts,
				exclude: [...PackageJson.defaultExcludes],
			}),
		];
	} else if (pkgJsonEnabled) {
		const pkgOpts = typeof options.packageJson === "object" ? options.packageJson : {};
		config[PackageJson.glob] = PackageJson.create(pkgOpts);
	}

	// Biome handler (standalone — excludes package.json by default)
	if (biomeEnabled) {
		const handlerOptions = typeof options.biome === "object" ? options.biome : {};
		config[Biome.glob] = Biome.create(handlerOptions);
	}

	// Markdown handler
	if (options.markdown !== false) {
		const handlerOptions = typeof options.markdown === "object" ? options.markdown : {};
		config[Markdown.glob] = Markdown.create(handlerOptions);
	}

	const pnpmEnabled = options.pnpmWorkspace !== false;
	const yamlEnabled = options.yaml !== false;

	// PnpmWorkspace + Yaml: use array syntax for sequential execution
	// Step 1: sort/format via CLI command (auto-staged), Step 2: validate only
	if (pnpmEnabled && yamlEnabled) {
		// exclude: [] overrides Yaml.defaultExcludes so pnpm-workspace.yaml is validated
		config[PnpmWorkspace.glob] = [PnpmWorkspace.fmtCommand(), Yaml.create({ exclude: [], skipFormat: true })];
	} else if (pnpmEnabled) {
		const pnpmOpts = typeof options.pnpmWorkspace === "object" ? options.pnpmWorkspace : {};
		config[PnpmWorkspace.glob] = PnpmWorkspace.create(pnpmOpts);
	}

	// Yaml handler: format via CLI command (auto-staged), then validate
	if (yamlEnabled) {
		const yamlOpts = typeof options.yaml === "object" ? options.yaml : {};
		config[Yaml.glob] = [Yaml.fmtCommand(yamlOpts), Yaml.create({ ...yamlOpts, skipFormat: true })];
	}

	// ShellScripts handler
	if (options.shellScripts !== false) {
		const handlerOptions = typeof options.shellScripts === "object" ? options.shellScripts : {};
		config[ShellScripts.glob] = ShellScripts.create(handlerOptions);
	}

	// TypeScript handler
	if (options.typescript !== false) {
		const handlerOptions = typeof options.typescript === "object" ? options.typescript : {};
		config[TypeScript.glob] = TypeScript.create(handlerOptions);
	}

	// Custom handlers
	if (options.custom) {
		for (const [glob, handler] of Object.entries(options.custom)) {
			config[glob] = handler;
		}
	}

	return config;
}

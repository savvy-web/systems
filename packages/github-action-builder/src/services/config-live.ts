/**
 * ConfigService Layer implementation.
 *
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Effect, Layer } from "effect";
import { createJiti } from "jiti";

import { ConfigInvalid, ConfigLoadFailed, ConfigNotFound, MainEntryMissing } from "../errors.js";
import type { ConfigInput } from "../schemas/config.js";
import { defineConfig } from "../schemas/config.js";
import type { DetectedEntry, LoadConfigOptions } from "./config.js";
import { ConfigService } from "./config.js";

// =============================================================================
// Constants
// =============================================================================

const CONFIG_FILENAMES = ["action.config.ts", "action.config.js", "action.config.mjs"];
const DEFAULT_ENTRIES = {
	main: "src/main.ts",
	pre: "src/pre.ts",
	post: "src/post.ts",
} as const;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Find config file in the given directory.
 */
function findConfigFile(cwd: string): string | undefined {
	for (const filename of CONFIG_FILENAMES) {
		const configPath = resolve(cwd, filename);
		if (existsSync(configPath)) {
			return configPath;
		}
	}
	return undefined;
}

/**
 * Detect a single optional entry.
 */
function detectOptionalEntry(cwd: string, type: "pre" | "post", explicitPath?: string): DetectedEntry | undefined {
	const defaultPath = DEFAULT_ENTRIES[type];
	const entryPath = explicitPath ?? defaultPath;
	const absolutePath = resolve(cwd, entryPath);

	if (existsSync(absolutePath)) {
		return {
			type,
			path: absolutePath,
			output: `dist/${type}.js`,
		};
	}

	return undefined;
}

// =============================================================================
// Layer Implementation
// =============================================================================

/**
 * Live implementation of ConfigService.
 */
export const ConfigServiceLive = Layer.succeed(ConfigService, {
	load: (options: LoadConfigOptions = {}) =>
		Effect.gen(function* () {
			const cwd = options.cwd ?? process.cwd();
			const configPath = options.configPath ?? findConfigFile(cwd);

			// No config file - use defaults
			if (!configPath) {
				return {
					config: defineConfig({}),
					usingDefaults: true,
				};
			}

			// Check file exists
			/* v8 ignore start - requires explicit configPath to non-existent file */
			if (!existsSync(configPath)) {
				return yield* Effect.fail(
					new ConfigNotFound({
						path: configPath,
						message: "Specified config file does not exist",
					}),
				);
			}
			/* v8 ignore stop */

			// Load the config file via dynamic import
			// Use jiti for .ts files since Node.js can't natively import TypeScript
			const absolutePath = resolve(cwd, configPath);
			/* v8 ignore start - requires invalid JS/TS config file */
			const configModule = yield* Effect.tryPromise({
				try: async () => {
					if (absolutePath.endsWith(".ts")) {
						const jiti = createJiti(absolutePath, { interopDefault: true });
						return jiti.import(absolutePath);
					}
					return import(absolutePath);
				},
				catch: (error) =>
					new ConfigLoadFailed({
						path: configPath,
						cause: error,
					}),
			});
			/* v8 ignore stop */

			// Get the default export
			const configInput = configModule.default as ConfigInput | undefined;
			/* v8 ignore start - requires config file with non-object default export */
			if (!configInput || typeof configInput !== "object") {
				return yield* Effect.fail(
					new ConfigInvalid({
						path: configPath,
						errors: ["Config file must export a default configuration object"],
					}),
				);
			}
			/* v8 ignore stop */

			// Resolve with defaults
			const config = defineConfig(configInput);

			return {
				config,
				configPath,
				usingDefaults: false,
			};
		}),

	resolve: (input: Partial<ConfigInput> = {}) => Effect.succeed(defineConfig(input)),

	detectEntries: (cwd: string, entries?: { main?: string; pre?: string; post?: string }) =>
		Effect.gen(function* () {
			const detected: DetectedEntry[] = [];

			// Check main entry (required)
			const mainPath = entries?.main ?? DEFAULT_ENTRIES.main;
			const absoluteMainPath = resolve(cwd, mainPath);

			if (!existsSync(absoluteMainPath)) {
				return yield* Effect.fail(
					new MainEntryMissing({
						expectedPath: mainPath,
						cwd,
					}),
				);
			}

			detected.push({
				type: "main",
				path: absoluteMainPath,
				output: "dist/main.js",
			});

			// Check optional entries
			const preEntry = detectOptionalEntry(cwd, "pre", entries?.pre);
			if (preEntry) {
				detected.push(preEntry);
			}

			const postEntry = detectOptionalEntry(cwd, "post", entries?.post);
			if (postEntry) {
				detected.push(postEntry);
			}

			return {
				success: true,
				entries: detected,
			};
		}),
});

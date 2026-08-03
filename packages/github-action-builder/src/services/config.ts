/**
 * ConfigService - Effect service for configuration management.
 *
 * @remarks
 * Provides configuration loading, resolution, and entry point detection
 * using Effect's service pattern with Context.Service.
 *
 * @internal
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Context, Effect, Layer, Schema } from "effect";
import { createJiti } from "jiti";

import type { ConfigError } from "../errors.js";
import {
	ConfigInvalid,
	ConfigLoadFailed,
	ConfigNotFound,
	MainEntryMissing,
	WorkerEntryInvalidName,
	WorkerEntryMissing,
} from "../errors.js";
import type { Config, ConfigInput } from "../schemas/config.js";
import { ConfigSchema, defineConfig } from "../schemas/config.js";
import { OptionalPathLikeSchema } from "../schemas/path.js";

// =============================================================================
// Constants
// =============================================================================

const CONFIG_FILENAMES = ["action.config.ts", "action.config.js", "action.config.mjs"];
const DEFAULT_ENTRIES = {
	main: "src/main.ts",
	pre: "src/pre.ts",
	post: "src/post.ts",
} as const;

/** Lifecycle bundle names a worker entry must not reuse — they own `dist/main.js` etc. */
const RESERVED_ENTRY_NAMES: ReadonlySet<string> = new Set(["main", "pre", "post"]);

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
// Schemas
// =============================================================================

/**
 * Options for loading configuration.
 * @public
 */
export const LoadConfigOptionsSchema = Schema.Struct({
	/** Working directory to search for config. Accepts string, Buffer, or URL. */
	cwd: OptionalPathLikeSchema,
	/** Explicit path to config file. Accepts string, Buffer, or URL. */
	configPath: OptionalPathLikeSchema,
});

/**
 * Options for loading configuration.
 * @public
 */
export type LoadConfigOptions = typeof LoadConfigOptionsSchema.Type;

/**
 * Entry point type.
 * @internal
 */
export const EntryTypeSchema = Schema.Literals(["main", "pre", "post"]);

/**
 * Entry point type literal.
 * @public
 */
export type EntryType = typeof EntryTypeSchema.Type;

/**
 * Detected entry point information.
 * @public
 */
export const DetectedEntrySchema = Schema.Struct({
	/** Entry type: "main"|"pre"|"post" for lifecycle entries, or the worker name. */
	type: Schema.String,
	/** Absolute path to the entry file. */
	path: Schema.String,
	/** Output path for the bundled file. */
	output: Schema.String,
});

/**
 * Detected entry point information.
 * @public
 */
export type DetectedEntry = typeof DetectedEntrySchema.Type;

/**
 * Result of entry detection.
 * @public
 */
export const DetectEntriesResultSchema = Schema.Struct({
	/** Whether detection was successful. */
	success: Schema.Boolean,
	/** Detected entries. */
	entries: Schema.Array(DetectedEntrySchema),
});

/**
 * Result of entry detection.
 * @public
 */
export type DetectEntriesResult = typeof DetectEntriesResultSchema.Type;

/**
 * Result of configuration loading.
 * @internal
 */
export const LoadConfigResultSchema = Schema.Struct({
	/** The resolved configuration. */
	config: ConfigSchema,
	/** Path to the config file that was loaded, if any. */
	configPath: Schema.optional(Schema.String),
	/** Whether defaults were used (no config file found). */
	usingDefaults: Schema.Boolean,
});

/**
 * Result of configuration loading.
 * @public
 */
export interface LoadConfigResult {
	/** The resolved configuration. */
	config: Config;
	/** Path to the config file that was loaded, if any. */
	configPath?: string;
	/** Whether defaults were used (no config file found). */
	usingDefaults: boolean;
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * Service shape for configuration management capabilities.
 *
 * @remarks
 * This service handles:
 * - Loading configuration from `action.config.ts` files
 * - Resolving partial configuration with defaults
 * - Detecting entry points in the project
 *
 * Use this interface to type structural implementations (e.g. test mocks);
 * use the {@link ConfigService} class as the service key.
 *
 * @public
 */
export interface ConfigServiceShape {
	/**
	 * Load configuration from file or use defaults.
	 *
	 * @param options - Loading options
	 * @returns Effect that resolves to the loaded configuration
	 */
	readonly load: (options?: LoadConfigOptions) => Effect.Effect<LoadConfigResult, ConfigError>;

	/**
	 * Resolve partial configuration input to full configuration.
	 *
	 * @param input - Partial configuration input
	 * @returns Effect that resolves to full configuration
	 */
	readonly resolve: (input?: Partial<ConfigInput>) => Effect.Effect<Config, ConfigError>;

	/**
	 * Detect entry points in the project.
	 *
	 * @param cwd - Working directory to search
	 * @param entries - Optional explicit entry configuration
	 * @returns Effect that resolves to detected entries
	 */
	readonly detectEntries: (
		cwd: string,
		entries?: { main?: string; pre?: string; post?: string; workers?: Record<string, string> },
	) => Effect.Effect<DetectEntriesResult, MainEntryMissing | WorkerEntryMissing | WorkerEntryInvalidName>;
}

/**
 * ConfigService key for dependency injection.
 *
 * @example Using ConfigService with Effect
 * ```typescript
 * import { Effect } from "effect";
 * import { AppLayer, ConfigService } from "@savvy-web/github-action-builder";
 *
 * const program = Effect.gen(function* () {
 *   const configService = yield* ConfigService;
 *   const result = yield* configService.load({ cwd: process.cwd() });
 *   console.log("Loaded config:", result.config);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
 * ```
 *
 * @public
 */
export class ConfigService extends Context.Service<ConfigService, ConfigServiceShape>()("ConfigService") {
	/**
	 * Production implementation of {@link ConfigService}.
	 *
	 * @public
	 */
	static readonly layer: Layer.Layer<ConfigService> = Layer.succeed(this, {
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

		detectEntries: (
			cwd: string,
			entries?: { main?: string; pre?: string; post?: string; workers?: Record<string, string> },
		) =>
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

				// Worker entries (extra non-lifecycle bundles). The name becomes both the rsbuild
				// entry key and the emitted filename (dist/<name>.js), so reject names that would
				// collide with a lifecycle bundle or escape dist/ before deriving the output path.
				for (const [name, workerPath] of Object.entries(entries?.workers ?? {})) {
					if (RESERVED_ENTRY_NAMES.has(name)) {
						return yield* Effect.fail(
							new WorkerEntryInvalidName({
								workerName: name,
								reason: `"${name}" is a reserved lifecycle bundle name (main/pre/post)`,
							}),
						);
					}
					if (name.length === 0 || name.includes("/") || name.includes("\\") || name.includes("..")) {
						return yield* Effect.fail(
							new WorkerEntryInvalidName({
								workerName: name,
								reason: "worker names must be non-empty and free of path separators",
							}),
						);
					}
					const absoluteWorkerPath = resolve(cwd, workerPath);
					if (!existsSync(absoluteWorkerPath)) {
						return yield* Effect.fail(new WorkerEntryMissing({ workerName: name, expectedPath: workerPath, cwd }));
					}
					detected.push({ type: name, path: absoluteWorkerPath, output: `dist/${name}.js` });
				}

				return {
					success: true,
					entries: detected,
				};
			}),
	});
}

/**
 * ConfigService - Effect service for configuration management.
 *
 * @remarks
 * Provides configuration loading, resolution, and entry point detection
 * using Effect's service pattern with Context.Tag.
 *
 * @internal
 */
import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { ConfigError, MainEntryMissing } from "../errors.js";
import type { Config, ConfigInput } from "../schemas/config.js";
import { ConfigSchema } from "../schemas/config.js";
import { OptionalPathLikeSchema } from "../schemas/path.js";

// =============================================================================
// Schemas
// =============================================================================

/**
 * Options for loading configuration.
 * @internal
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
export const EntryTypeSchema = Schema.Literal("main", "pre", "post");

/**
 * Entry point type literal.
 * @public
 */
export type EntryType = typeof EntryTypeSchema.Type;

/**
 * Detected entry point information.
 * @internal
 */
export const DetectedEntrySchema = Schema.Struct({
	/** Entry type (main, pre, or post). */
	type: EntryTypeSchema,
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
 * @internal
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
 * ConfigService interface for configuration management capabilities.
 *
 * @remarks
 * This service handles:
 * - Loading configuration from `action.config.ts` files
 * - Resolving partial configuration with defaults
 * - Detecting entry points in the project
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
export interface ConfigService {
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
		entries?: { main?: string; pre?: string; post?: string },
	) => Effect.Effect<DetectEntriesResult, MainEntryMissing>;
}

/**
 * ConfigService tag for dependency injection.
 *
 * @public
 */
export const ConfigService = Context.GenericTag<ConfigService>("ConfigService");

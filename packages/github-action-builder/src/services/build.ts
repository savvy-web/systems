/**
 * BuildService - Effect service for building GitHub Actions.
 *
 * @remarks
 * Provides bundling and build orchestration capabilities
 * using Effect's service pattern with Context.Tag.
 *
 * @internal
 */
import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { BuildError, MainEntryMissing } from "../errors.js";
import type { Config } from "../schemas/config.js";
import { OptionalPathLikeSchema } from "../schemas/path.js";
import type { DetectedEntry } from "./config.js";

// =============================================================================
// Schemas
// =============================================================================

/**
 * Options for the build process.
 * @internal
 */
export const BuildRunnerOptionsSchema = Schema.Struct({
	/** Working directory for the build. Accepts string, Buffer, or URL. */
	cwd: OptionalPathLikeSchema,
	/** Clean output directory before building. Defaults to true. */
	clean: Schema.optional(Schema.Boolean),
});

/**
 * Options for the build process.
 * @public
 */
export type BuildRunnerOptions = typeof BuildRunnerOptionsSchema.Type;

/**
 * Statistics for a single bundled entry.
 * @internal
 */
export const BundleStatsSchema = Schema.Struct({
	/** Entry type (main, pre, or post). */
	entry: Schema.String,
	/** Bundle size in bytes. */
	size: Schema.Number,
	/** Build duration in milliseconds. */
	duration: Schema.Number,
	/** Output path relative to working directory. */
	outputPath: Schema.String,
});

/**
 * Statistics for a single bundled entry.
 * @public
 */
export type BundleStats = typeof BundleStatsSchema.Type;

/**
 * Result of bundling a single entry.
 * @internal
 */
export const BundleResultSchema = Schema.Struct({
	/** Whether bundling succeeded. */
	success: Schema.Boolean,
	/** Bundle statistics if successful. */
	stats: Schema.optional(BundleStatsSchema),
	/** Error message if failed. */
	error: Schema.optional(Schema.String),
});

/**
 * Result of bundling a single entry.
 * @public
 */
export type BundleResult = typeof BundleResultSchema.Type;

/**
 * Result of the complete build process.
 * @internal
 */
export const BuildResultSchema = Schema.Struct({
	/** Whether the overall build succeeded. */
	success: Schema.Boolean,
	/** Results for each entry that was built. */
	entries: Schema.Array(BundleResultSchema),
	/** Total build duration in milliseconds. */
	duration: Schema.Number,
	/** Error message if build failed. */
	error: Schema.optional(Schema.String),
});

/**
 * Result of the complete build process.
 * @public
 */
export type BuildResult = typeof BuildResultSchema.Type;

// =============================================================================
// Service Definition
// =============================================================================

/**
 * BuildService interface for build and bundling capabilities.
 *
 * @remarks
 * This service handles:
 * - Bundling TypeScript entries with rsbuild
 * - Managing output directory
 * - Collecting build statistics
 * - Formatting build results
 *
 * @example Using BuildService with Effect
 * ```typescript
 * import { Effect } from "effect";
 * import { AppLayer, BuildService, ConfigService } from "@savvy-web/github-action-builder";
 *
 * const program = Effect.gen(function* () {
 *   const configService = yield* ConfigService;
 *   const buildService = yield* BuildService;
 *
 *   const { config } = yield* configService.load();
 *   const result = yield* buildService.build(config);
 *
 *   if (result.success) {
 *     console.log("Build complete:", result.entries.length, "entries");
 *   }
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
 * ```
 *
 * @public
 */
export interface BuildService {
	/**
	 * Build all entries from the configuration.
	 *
	 * @param config - Configuration with entry points
	 * @param options - Build options
	 * @returns Effect that resolves to build result
	 */
	readonly build: (
		config: Config,
		options?: BuildRunnerOptions,
	) => Effect.Effect<BuildResult, BuildError | MainEntryMissing>;

	/**
	 * Bundle a single entry point.
	 *
	 * @param entry - Entry to bundle
	 * @param config - Build configuration
	 * @returns Effect that resolves to bundle result
	 */
	readonly bundle: (entry: DetectedEntry, config: Config) => Effect.Effect<BundleResult, BuildError>;

	/**
	 * Clean the output directory.
	 *
	 * @param outputDir - Directory to clean
	 * @returns Effect that resolves when complete
	 */
	readonly clean: (outputDir: string) => Effect.Effect<void, BuildError>;

	/**
	 * Format build result for display.
	 *
	 * @param result - Build result to format
	 * @returns Formatted string for terminal output
	 */
	readonly formatResult: (result: BuildResult) => string;

	/**
	 * Format bytes as human-readable string.
	 *
	 * @param bytes - Number of bytes
	 * @returns Formatted string like "1.5 MB"
	 */
	readonly formatBytes: (bytes: number) => string;
}

/**
 * BuildService tag for dependency injection.
 *
 * @public
 */
export const BuildService = Context.GenericTag<BuildService>("BuildService");

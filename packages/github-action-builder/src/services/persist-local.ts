/**
 * PersistLocalService - Effect service for copying build output to a local action directory.
 *
 * @remarks
 * Provides smart-sync of action.yml and dist/ to a local directory
 * for testing with nektos/act.
 *
 * @internal
 */
import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { ActionYmlPathError, PersistLocalError } from "../errors.js";
import type { Config } from "../schemas/config.js";

// =============================================================================
// Schemas
// =============================================================================

/**
 * Options for the persist operation.
 * @internal
 */
export const PersistLocalRunnerOptionsSchema = Schema.Struct({
	/** Working directory. Accepts string. */
	cwd: Schema.optional(Schema.String),
});

/**
 * Options for the persist operation.
 * @public
 */
export type PersistLocalRunnerOptions = typeof PersistLocalRunnerOptionsSchema.Type;

/**
 * Result of the persist-local operation.
 * @internal
 */
export const PersistLocalResultSchema = Schema.Struct({
	/** Whether the operation completed successfully. */
	success: Schema.Boolean,
	/** Number of files copied (changed or new). */
	filesCopied: Schema.Number,
	/** Number of files skipped (unchanged). */
	filesSkipped: Schema.Number,
	/** Whether act template files were generated. */
	actTemplateGenerated: Schema.Boolean,
	/** Output path where files were persisted. */
	outputPath: Schema.String,
	/** Error message if failed. */
	error: Schema.optional(Schema.String),
});

/**
 * Result of the persist-local operation.
 * @public
 */
export type PersistLocalResult = typeof PersistLocalResultSchema.Type;

// =============================================================================
// Service Definition
// =============================================================================

/**
 * PersistLocalService interface for copying build output locally.
 *
 * @remarks
 * This service handles:
 * - Smart-syncing action.yml and dist/ to a local action directory
 * - Hash-based comparison to avoid unnecessary copies
 * - Removing stale files in the destination
 * - Validating action.yml runs paths resolve in the destination
 * - Generating act boilerplate files
 *
 * @public
 */
export interface PersistLocalService {
	/**
	 * Persist build output to the local action directory.
	 *
	 * @param config - Configuration with persistLocal options
	 * @param options - Runner options (cwd, etc.)
	 * @returns Effect that resolves to persist result
	 */
	readonly persist: (
		config: Config,
		options?: PersistLocalRunnerOptions,
	) => Effect.Effect<PersistLocalResult, PersistLocalError | ActionYmlPathError>;

	/**
	 * Format persist result for display.
	 *
	 * @param result - Persist result to format
	 * @returns Formatted string for terminal output
	 */
	readonly formatResult: (result: PersistLocalResult) => string;
}

/**
 * PersistLocalService tag for dependency injection.
 *
 * @public
 */
export const PersistLocalService = Context.GenericTag<PersistLocalService>("PersistLocalService");

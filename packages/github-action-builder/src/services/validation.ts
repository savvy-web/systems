/**
 * ValidationService - Effect service for validation.
 *
 * @remarks
 * Provides validation of configuration, entry points, and action.yml
 * using Effect's service pattern with Context.Tag.
 *
 * @internal
 */
import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { ValidationError } from "../errors.js";
import type { Config } from "../schemas/config.js";
import { OptionalPathLikeSchema } from "../schemas/path.js";

// =============================================================================
// Schemas
// =============================================================================

/**
 * Options for validation.
 * @internal
 */
export const ValidateOptionsSchema = Schema.Struct({
	/** Working directory for file operations. Accepts string, Buffer, or URL. */
	cwd: OptionalPathLikeSchema,
	/** Force strict mode regardless of environment. Auto-detects from CI when undefined. */
	strict: Schema.optional(Schema.Boolean),
});

/**
 * Options for validation.
 * @public
 */
export type ValidateOptions = typeof ValidateOptionsSchema.Type;

/**
 * A validation error item.
 * @internal
 */
export const ValidationErrorSchema = Schema.Struct({
	/** Error code for categorization. */
	code: Schema.String,
	/** Human-readable error message. */
	message: Schema.String,
	/** File path where error occurred. */
	file: Schema.optional(Schema.String),
	/** Suggestion for fixing the error. */
	suggestion: Schema.optional(Schema.String),
});

/**
 * A validation error item.
 * @public
 */
export type ValidationErrorItem = typeof ValidationErrorSchema.Type;

/**
 * A validation warning.
 * @internal
 */
export const ValidationWarningSchema = Schema.Struct({
	/** Warning code for categorization. */
	code: Schema.String,
	/** Human-readable warning message. */
	message: Schema.String,
	/** File path where warning occurred. */
	file: Schema.optional(Schema.String),
	/** Suggestion for addressing the warning. */
	suggestion: Schema.optional(Schema.String),
});

/**
 * A validation warning.
 * @public
 */
export type ValidationWarning = typeof ValidationWarningSchema.Type;

/**
 * Validation result with errors and warnings.
 * @internal
 */
export const ValidationResultSchema = Schema.Struct({
	/** Whether validation passed (no errors, or only warnings in non-strict mode). */
	valid: Schema.Boolean,
	/** Validation errors. */
	errors: Schema.Array(ValidationErrorSchema),
	/** Validation warnings. */
	warnings: Schema.Array(ValidationWarningSchema),
});

/**
 * Validation result with errors and warnings.
 * @public
 */
export type ValidationResult = typeof ValidationResultSchema.Type;

/**
 * Result of action.yml validation.
 * @internal
 */
export const ActionYmlResultSchema = Schema.Struct({
	/** Whether the action.yml is valid. */
	valid: Schema.Boolean,
	/** Parsed action.yml content if valid. */
	content: Schema.optional(Schema.Any),
	/** Validation errors. */
	errors: Schema.Array(ValidationErrorSchema),
	/** Validation warnings. */
	warnings: Schema.Array(ValidationWarningSchema),
});

/**
 * Result of action.yml validation.
 * @public
 */
export type ActionYmlResult = typeof ActionYmlResultSchema.Type;

// =============================================================================
// Service Definition
// =============================================================================

/**
 * ValidationService interface for validation capabilities.
 *
 * @remarks
 * This service handles:
 * - Validating configuration and entry points
 * - Validating action.yml structure and schema
 * - Formatting validation results for display
 * - CI-aware strict mode handling
 *
 * @example Using ValidationService with Effect
 * ```typescript
 * import { Effect } from "effect";
 * import { AppLayer, ConfigService, ValidationService } from "@savvy-web/github-action-builder";
 *
 * const program = Effect.gen(function* () {
 *   const configService = yield* ConfigService;
 *   const validationService = yield* ValidationService;
 *
 *   const { config } = yield* configService.load();
 *   const result = yield* validationService.validate(config);
 *
 *   if (!result.valid) {
 *     console.error("Validation failed:", result.errors);
 *   }
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
 * ```
 *
 * @public
 */
export interface ValidationService {
	/**
	 * Validate configuration and project structure.
	 *
	 * @param config - Configuration to validate
	 * @param options - Validation options
	 * @returns Effect that resolves to validation result
	 */
	readonly validate: (config: Config, options?: ValidateOptions) => Effect.Effect<ValidationResult, ValidationError>;

	/**
	 * Validate action.yml file.
	 *
	 * @param path - Path to action.yml file
	 * @returns Effect that resolves to action.yml validation result
	 */
	readonly validateActionYml: (path: string) => Effect.Effect<ActionYmlResult, ValidationError>;

	/**
	 * Format validation result for display.
	 *
	 * @param result - Validation result to format
	 * @returns Formatted string for terminal output
	 */
	readonly formatResult: (result: ValidationResult) => string;

	/**
	 * Check if running in CI environment.
	 *
	 * @returns Effect that resolves to true if in CI
	 */
	readonly isCI: () => Effect.Effect<boolean>;

	/**
	 * Check if strict mode is enabled.
	 *
	 * @param configStrict - Optional config override
	 * @returns Effect that resolves to true if strict mode
	 */
	readonly isStrict: (configStrict?: boolean) => Effect.Effect<boolean>;
}

/**
 * ValidationService tag for dependency injection.
 *
 * @public
 */
export const ValidationService = Context.GenericTag<ValidationService>("ValidationService");

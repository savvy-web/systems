/**
 * Typed error classes for GitHub Action Builder.
 *
 * @remarks
 * Uses Effect's Data.TaggedError pattern for type-safe error handling
 * with pattern matching support via the `_tag` discriminant.
 *
 * @example Pattern matching on errors
 * ```typescript
 * import { ConfigNotFound, ConfigInvalid } from "@savvy-web/github-action-builder";
 *
 * function handleError(error: ConfigError): string {
 *   switch (error._tag) {
 *     case "ConfigNotFound":
 *       return `Config not found at ${error.path}`;
 *     case "ConfigInvalid":
 *       return `Invalid config: ${error.errors.join(", ")}`;
 *     case "ConfigLoadFailed":
 *       return `Failed to load config: ${error.cause}`;
 *   }
 * }
 * ```
 */
import { Data } from "effect";

// =============================================================================
// Config Errors
// =============================================================================

/**
 * Base class for ConfigNotFound error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const ConfigNotFoundBase = Data.TaggedError("ConfigNotFound");

/**
 * Error when configuration file is not found.
 *
 * @public
 */
export class ConfigNotFound extends ConfigNotFoundBase<{
	/**
	 * The path that was searched for the config file.
	 */
	readonly path: string;

	/**
	 * Additional context about the search.
	 */
	readonly message?: string;
}> {}

/**
 * Base class for ConfigInvalid error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const ConfigInvalidBase = Data.TaggedError("ConfigInvalid");

/**
 * Error when configuration file exists but contains invalid content.
 *
 * @public
 */
export class ConfigInvalid extends ConfigInvalidBase<{
	/**
	 * The path to the invalid config file.
	 */
	readonly path: string;

	/**
	 * List of validation errors.
	 */
	readonly errors: ReadonlyArray<string>;
}> {}

/**
 * Base class for ConfigLoadFailed error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const ConfigLoadFailedBase = Data.TaggedError("ConfigLoadFailed");

/**
 * Error when configuration file fails to load (import error, syntax error, etc.).
 *
 * @public
 */
export class ConfigLoadFailed extends ConfigLoadFailedBase<{
	/**
	 * The path to the config file that failed to load.
	 */
	readonly path: string;

	/**
	 * The underlying error or error message.
	 */
	readonly cause: unknown;
}> {}

/**
 * Union of all configuration-related errors.
 *
 * @public
 */
export type ConfigError = ConfigNotFound | ConfigInvalid | ConfigLoadFailed;

// =============================================================================
// Validation Errors
// =============================================================================

/**
 * Base class for MainEntryMissing error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const MainEntryMissingBase = Data.TaggedError("MainEntryMissing");

/**
 * Error when the required main entry point is missing.
 *
 * @public
 */
export class MainEntryMissing extends MainEntryMissingBase<{
	/**
	 * The expected path for the main entry.
	 */
	readonly expectedPath: string;

	/**
	 * The working directory that was searched.
	 */
	readonly cwd: string;
}> {}

/**
 * Base class for EntryFileMissing error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const EntryFileMissingBase = Data.TaggedError("EntryFileMissing");

/**
 * Error when an explicitly specified entry file is missing.
 *
 * @public
 */
export class EntryFileMissing extends EntryFileMissingBase<{
	/**
	 * The type of entry (main, pre, post).
	 */
	readonly entryType: "main" | "pre" | "post";

	/**
	 * The path that was specified but not found.
	 */
	readonly path: string;
}> {}

/**
 * Base class for ActionYmlMissing error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const ActionYmlMissingBase = Data.TaggedError("ActionYmlMissing");

/**
 * Error when action.yml file is missing.
 *
 * @public
 */
export class ActionYmlMissing extends ActionYmlMissingBase<{
	/**
	 * The working directory that was searched.
	 */
	readonly cwd: string;
}> {}

/**
 * Base class for ActionYmlSyntaxError error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const ActionYmlSyntaxErrorBase = Data.TaggedError("ActionYmlSyntaxError");

/**
 * Error when action.yml has invalid YAML syntax.
 *
 * @public
 */
export class ActionYmlSyntaxError extends ActionYmlSyntaxErrorBase<{
	/**
	 * The path to the action.yml file.
	 */
	readonly path: string;

	/**
	 * The syntax error message.
	 */
	readonly message: string;

	/**
	 * Line number where the error occurred, if available.
	 */
	readonly line?: number;

	/**
	 * Column number where the error occurred, if available.
	 */
	readonly column?: number;
}> {}

/**
 * Base class for ActionYmlSchemaError error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const ActionYmlSchemaErrorBase = Data.TaggedError("ActionYmlSchemaError");

/**
 * Error when action.yml fails schema validation.
 *
 * @public
 */
export class ActionYmlSchemaError extends ActionYmlSchemaErrorBase<{
	/**
	 * The path to the action.yml file.
	 */
	readonly path: string;

	/**
	 * List of schema validation errors.
	 */
	readonly errors: ReadonlyArray<{
		readonly path: string;
		readonly message: string;
	}>;
}> {}

/**
 * Base class for ValidationFailed error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const ValidationFailedBase = Data.TaggedError("ValidationFailed");

/**
 * Error when validation fails in strict mode (CI environment).
 *
 * @public
 */
export class ValidationFailed extends ValidationFailedBase<{
	/**
	 * Number of errors encountered.
	 */
	readonly errorCount: number;

	/**
	 * Number of warnings encountered.
	 */
	readonly warningCount: number;

	/**
	 * Formatted validation result message.
	 */
	readonly message: string;
}> {}

/**
 * Union of all validation-related errors.
 *
 * @public
 */
export type ValidationError =
	| MainEntryMissing
	| EntryFileMissing
	| ActionYmlMissing
	| ActionYmlSyntaxError
	| ActionYmlSchemaError
	| ValidationFailed;

// =============================================================================
// Build Errors
// =============================================================================

/**
 * Base class for BundleFailed error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const BundleFailedBase = Data.TaggedError("BundleFailed");

/**
 * Error when bundling with rsbuild fails.
 *
 * @public
 */
export class BundleFailed extends BundleFailedBase<{
	/**
	 * The entry file that failed to bundle.
	 */
	readonly entry: string;

	/**
	 * The underlying error or error message.
	 */
	readonly cause: unknown;
}> {}

/**
 * Base class for WriteError error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const WriteErrorBase = Data.TaggedError("WriteError");

/**
 * Error when writing output files fails.
 *
 * @public
 */
export class WriteError extends WriteErrorBase<{
	/**
	 * The path that failed to write.
	 */
	readonly path: string;

	/**
	 * The underlying error or error message.
	 */
	readonly cause: unknown;
}> {}

/**
 * Base class for CleanError error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const CleanErrorBase = Data.TaggedError("CleanError");

/**
 * Error when cleaning the output directory fails.
 *
 * @public
 */
export class CleanError extends CleanErrorBase<{
	/**
	 * The directory that failed to clean.
	 */
	readonly directory: string;

	/**
	 * The underlying error or error message.
	 */
	readonly cause: unknown;
}> {}

/**
 * Base class for BuildFailed error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const BuildFailedBase = Data.TaggedError("BuildFailed");

/**
 * Error when the build process fails overall.
 *
 * @public
 */
export class BuildFailed extends BuildFailedBase<{
	/**
	 * Summary message of the build failure.
	 */
	readonly message: string;

	/**
	 * Number of entries that failed.
	 */
	readonly failedEntries: number;
}> {}

/**
 * Union of all build-related errors.
 *
 * @public
 */
export type BuildError = BundleFailed | WriteError | CleanError | BuildFailed;

// =============================================================================
// Persist Local Errors
// =============================================================================

/**
 * Base class for PersistLocalError error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const PersistLocalErrorBase = Data.TaggedError("PersistLocalError");

/**
 * Error when persisting build output to local action directory fails.
 *
 * @public
 */
export class PersistLocalError extends PersistLocalErrorBase<{
	/**
	 * The path involved in the failure.
	 */
	readonly path: string;

	/**
	 * The underlying error or error message.
	 */
	readonly cause: unknown;
}> {}

/**
 * Base class for ActionYmlPathError error.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Data.TaggedError creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const ActionYmlPathErrorBase = Data.TaggedError("ActionYmlPathError");

/**
 * Error when action.yml runs paths don't resolve correctly in destination.
 *
 * @public
 */
export class ActionYmlPathError extends ActionYmlPathErrorBase<{
	/**
	 * The entry type whose path failed validation (main, pre, post).
	 */
	readonly entryType: string;

	/**
	 * The path specified in action.yml.
	 */
	readonly specifiedPath: string;

	/**
	 * The expected resolved path.
	 */
	readonly expectedPath: string;
}> {}

/**
 * Union of all persist-local-related errors.
 *
 * @public
 */
export type PersistError = PersistLocalError | ActionYmlPathError;

// =============================================================================
// Combined Error Type
// =============================================================================

/**
 * Union of all possible errors in the GitHub Action Builder.
 *
 * @public
 */
export type AppError = ConfigError | ValidationError | BuildError | PersistError;

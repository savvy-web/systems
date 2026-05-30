/* v8 ignore start - barrel file only re-exports, no logic to test */
/**
 * GitHub Action Builder
 *
 * A zero-config build tool for creating GitHub Actions from TypeScript source code.
 * This package provides both a programmatic API and CLI for bundling TypeScript
 * GitHub Actions into production-ready JavaScript bundles.
 *
 * @remarks
 * The package uses rsbuild under the hood to create single-file bundles
 * that include all dependencies. It automatically detects entry points
 * (`main.ts`, `pre.ts`, `post.ts`) and validates `action.yml` configuration.
 *
 * @example Programmatic usage with GitHubAction class
 * ```typescript
 * import { GitHubAction } from "@savvy-web/github-action-builder";
 *
 * async function main(): Promise<void> {
 *   const action = GitHubAction.create();
 *   const result = await action.build();
 *
 *   if (result.success) {
 *     console.log("Build completed successfully");
 *   } else {
 *     console.error(result.error);
 *     process.exit(1);
 *   }
 * }
 *
 * main();
 * ```
 *
 * @example Configuration file (action.config.ts)
 * ```typescript
 * import { defineConfig } from "@savvy-web/github-action-builder";
 *
 * export default defineConfig({
 *   entries: {
 *     main: "src/main.ts",
 *     post: "src/cleanup.ts",
 *   },
 *   build: {
 *     minify: true,
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Primary API
// =============================================================================

export type { GitHubActionBuildResult, GitHubActionOptions } from "./github-action.js";
export { GitHubAction, GitHubActionBuildResultSchema } from "./github-action.js";

// =============================================================================
// Configuration
// =============================================================================

export type {
	BuildOptions,
	Config,
	ConfigInput,
	Entries,
	PersistLocalOptions,
	ValidationOptions,
} from "./schemas/config.js";
export {
	BuildOptionsSchema,
	ConfigInputSchema,
	ConfigSchema,
	EntriesSchema,
	PersistLocalOptionsSchema,
	ValidationOptionsSchema,
	defineConfig,
} from "./schemas/config.js";

// =============================================================================
// Error Types
// =============================================================================

export type { AppError, BuildError, ConfigError, PersistError, ValidationError } from "./errors.js";
export {
	ActionYmlMissing,
	ActionYmlMissingBase,
	ActionYmlPathError,
	ActionYmlPathErrorBase,
	ActionYmlSchemaError,
	ActionYmlSchemaErrorBase,
	ActionYmlSyntaxError,
	ActionYmlSyntaxErrorBase,
	BuildFailed,
	BuildFailedBase,
	BundleFailed,
	BundleFailedBase,
	CleanError,
	CleanErrorBase,
	ConfigInvalid,
	ConfigInvalidBase,
	ConfigLoadFailed,
	ConfigLoadFailedBase,
	ConfigNotFound,
	ConfigNotFoundBase,
	EntryFileMissing,
	EntryFileMissingBase,
	MainEntryMissing,
	MainEntryMissingBase,
	PersistLocalError,
	PersistLocalErrorBase,
	ValidationFailed,
	ValidationFailedBase,
	WriteError,
	WriteErrorBase,
} from "./errors.js";

// =============================================================================
// Build Service Types
// =============================================================================

export type { BuildResult, BuildRunnerOptions, BundleResult, BundleStats } from "./services/build.js";
export {
	BuildResultSchema,
	BuildRunnerOptionsSchema,
	BuildService,
	BundleResultSchema,
	BundleStatsSchema,
} from "./services/build.js";

// =============================================================================
// Config Service Types
// =============================================================================

export type { DetectEntriesResult, DetectedEntry, LoadConfigOptions, LoadConfigResult } from "./services/config.js";
export {
	ConfigService,
	DetectEntriesResultSchema,
	DetectedEntrySchema,
	LoadConfigOptionsSchema,
} from "./services/config.js";

// =============================================================================
// Validation Service Types
// =============================================================================

export type {
	ActionYmlResult,
	ValidateOptions,
	ValidationErrorItem,
	ValidationResult,
	ValidationWarning,
} from "./services/validation.js";
export {
	ActionYmlResultSchema,
	ValidateOptionsSchema,
	ValidationErrorSchema,
	ValidationResultSchema,
	ValidationService,
	ValidationWarningSchema,
} from "./services/validation.js";

// =============================================================================
// Persist Local Service Types
// =============================================================================

export type { PersistLocalResult, PersistLocalRunnerOptions } from "./services/persist-local.js";
export {
	PersistLocalResultSchema,
	PersistLocalRunnerOptionsSchema,
	PersistLocalService,
} from "./services/persist-local.js";

// =============================================================================
// Effect Layers
// =============================================================================

export { AppLayer, BuildLayer, ConfigLayer, PersistLocalLayer, ValidationLayer } from "./layers/app.js";

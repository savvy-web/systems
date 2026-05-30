/**
 * Main API for GitHub Action Builder.
 *
 * @remarks
 * This module provides the primary programmatic interface for building GitHub Actions.
 * The {@link GitHubAction} class wraps Effect services with a Promise-based API
 * for non-Effect consumers.
 */
import type { Layer } from "effect";
import { Effect, ManagedRuntime, Schema } from "effect";

import { AppLayer } from "./layers/app.js";
import type { Config, ConfigInput } from "./schemas/config.js";
import { defineConfig } from "./schemas/config.js";
import type { BuildRunnerOptions } from "./services/build.js";
import { BuildResultSchema, BuildService } from "./services/build.js";
import { ConfigService } from "./services/config.js";
import type { PersistLocalResult } from "./services/persist-local.js";
import { PersistLocalResultSchema, PersistLocalService } from "./services/persist-local.js";
import type { ValidateOptions, ValidationResult } from "./services/validation.js";
import { ValidationResultSchema, ValidationService } from "./services/validation.js";

// =============================================================================
// Options and Result Types
// =============================================================================

/**
 * Options for creating a GitHubAction builder instance.
 *
 * @remarks
 * All options are optional. When no options are provided, the builder
 * auto-detects configuration from `action.config.ts` in the current directory.
 *
 * @public
 */
export interface GitHubActionOptions {
	/**
	 * Configuration object or path to config file.
	 *
	 * @remarks
	 * - If a string is provided, it's treated as a path to a config file
	 * - If an object is provided, it's used directly as configuration
	 * - If not provided, auto-detects `action.config.ts` or uses defaults
	 */
	config?: Partial<ConfigInput> | string;

	/**
	 * Working directory for the build.
	 *
	 * @defaultValue `process.cwd()`
	 */
	cwd?: string;

	/**
	 * Skip validation before building.
	 *
	 * @remarks
	 * Skipping validation is not recommended for production builds.
	 *
	 * @defaultValue `false`
	 */
	skipValidation?: boolean;

	/**
	 * Clean output directory before building.
	 *
	 * @defaultValue `true`
	 */
	clean?: boolean;

	/**
	 * Custom Effect Layer to use instead of the default AppLayer.
	 *
	 * @remarks
	 * Advanced option for testing or customizing service implementations.
	 */
	layer?: Layer.Layer<ConfigService | ValidationService | BuildService | PersistLocalService>;
}

/**
 * Result of a GitHubAction build operation.
 *
 * @remarks
 * The result contains detailed information about both validation and build steps.
 * Check the `success` property first, then examine `error`, `validation`, or `build`
 * for details.
 *
 * @internal
 */
export const GitHubActionBuildResultSchema = Schema.Struct({
	/** Whether the build completed successfully. */
	success: Schema.Boolean,
	/** Build result details if the build step ran. */
	build: Schema.optional(BuildResultSchema),
	/** Validation result if validation was performed. */
	validation: Schema.optional(ValidationResultSchema),
	/** Persist-local result if persist was performed. */
	persistLocal: Schema.optional(PersistLocalResultSchema),
	/** Error message if the build or validation failed. */
	error: Schema.optional(Schema.String),
	/** Raw error object for programmatic inspection. */
	cause: Schema.optional(Schema.Unknown),
});

/**
 * Result of a GitHubAction build operation.
 * @public
 */
export type GitHubActionBuildResult = typeof GitHubActionBuildResultSchema.Type;

// =============================================================================
// GitHubAction Class
// =============================================================================

/**
 * Main API class for building GitHub Actions.
 *
 * @remarks
 * This class provides a Promise-based interface wrapping Effect services.
 * It handles configuration loading, validation, and bundling in a single workflow.
 *
 * For Effect consumers, use the services directly:
 * - {@link ConfigService} for configuration
 * - {@link ValidationService} for validation
 * - {@link BuildService} for building
 *
 * @example Complete build workflow
 * ```typescript
 * import { GitHubAction } from "@savvy-web/github-action-builder";
 *
 * async function buildAction(): Promise<void> {
 *   const action = GitHubAction.create();
 *   const result = await action.build();
 *
 *   if (result.success) {
 *     console.log(`Built ${result.build?.entries.length} entry points`);
 *   } else {
 *     console.error(`Build failed: ${result.error}`);
 *     process.exit(1);
 *   }
 * }
 *
 * buildAction();
 * ```
 *
 * @example With custom configuration
 * ```typescript
 * import { GitHubAction } from "@savvy-web/github-action-builder";
 *
 * async function main(): Promise<void> {
 *   const action = GitHubAction.create({
 *     config: {
 *       entries: { main: "src/action.ts" },
 *       build: { minify: true },
 *     },
 *     cwd: "/path/to/project",
 *   });
 *
 *   const result = await action.build();
 *   console.log(result.success ? "Success" : result.error);
 * }
 *
 * main();
 * ```
 *
 * @public
 */
export class GitHubAction {
	/**
	 * Managed runtime for running Effects.
	 * @internal
	 */
	private readonly runtime: ManagedRuntime.ManagedRuntime<
		ConfigService | ValidationService | BuildService | PersistLocalService,
		never
	>;

	/**
	 * Cached configuration after first load.
	 * @internal
	 */
	private config: Config | null = null;

	/**
	 * Resolved options.
	 * @internal
	 */
	private readonly cwd: string;
	private readonly configSource: Partial<ConfigInput> | string | undefined;
	private readonly skipValidation: boolean;
	private readonly clean: boolean;

	private constructor(options: GitHubActionOptions = {}) {
		const layer = options.layer ?? AppLayer;
		this.runtime = ManagedRuntime.make(layer);
		this.configSource = options.config;
		this.cwd = options.cwd ?? process.cwd();
		this.skipValidation = options.skipValidation ?? false;
		this.clean = options.clean ?? true;
	}

	/**
	 * Create a new GitHubAction builder instance.
	 *
	 * @param options - Builder options
	 * @returns A new GitHubAction instance
	 *
	 * @example
	 * ```typescript
	 * import { GitHubAction } from "@savvy-web/github-action-builder";
	 *
	 * // Auto-detect configuration
	 * const action = GitHubAction.create();
	 *
	 * // With inline config
	 * const action2 = GitHubAction.create({
	 *   config: { build: { minify: false } },
	 * });
	 *
	 * // With config file path
	 * const action3 = GitHubAction.create({
	 *   config: "./custom.config.ts",
	 * });
	 * ```
	 */
	static create(options: GitHubActionOptions = {}): GitHubAction {
		return new GitHubAction(options);
	}

	/**
	 * Load and resolve configuration.
	 *
	 * @remarks
	 * Configuration is cached after the first load. Subsequent calls
	 * return the cached configuration.
	 *
	 * @returns Resolved configuration with all defaults applied
	 * @throws Error if configuration file cannot be loaded or is invalid
	 */
	async loadConfig(): Promise<Config> {
		if (this.config) {
			return this.config;
		}

		const configSource = this.configSource;
		const cwd = this.cwd;

		const program = Effect.gen(function* () {
			const configService = yield* ConfigService;

			/* v8 ignore next 6 - requires config file path string */
			if (typeof configSource === "string") {
				const result = yield* configService.load({
					cwd,
					configPath: configSource,
				});
				return result.config;
			}

			if (configSource) {
				return defineConfig(configSource);
			}

			const result = yield* configService.load({ cwd });
			return result.config;
		});

		const config = await this.runtime.runPromise(program);
		this.config = config;
		return config;
	}

	/**
	 * Validate the action configuration and action.yml.
	 *
	 * @remarks
	 * Validation checks:
	 * - Entry point files exist
	 * - Output directory is writable
	 * - action.yml exists and is valid (if required)
	 *
	 * In CI environments, warnings are treated as errors by default.
	 *
	 * @param options - Validation options
	 * @returns Validation result with errors and warnings
	 */
	async validate(options: ValidateOptions = {}): Promise<ValidationResult> {
		const config = await this.loadConfig();
		const cwd = this.cwd;

		const program = Effect.gen(function* () {
			const validationService = yield* ValidationService;
			return yield* validationService.validate(config, {
				cwd,
				...options,
			});
		});

		return this.runtime.runPromise(program);
	}

	/**
	 * Build the GitHub Action.
	 *
	 * @remarks
	 * The build process:
	 * 1. Loads configuration (if not already loaded)
	 * 2. Validates the project (unless `skipValidation` is set)
	 * 3. Bundles each entry point with rsbuild
	 * 4. Writes output to the `dist/` directory
	 *
	 * @returns Build result with success status and details
	 *
	 * @example
	 * ```typescript
	 * import { GitHubAction } from "@savvy-web/github-action-builder";
	 *
	 * async function main(): Promise<void> {
	 *   const action = GitHubAction.create();
	 *   const result = await action.build();
	 *
	 *   if (result.success && result.build) {
	 *     console.log(`Built ${result.build.entries.length} entries`);
	 *   } else {
	 *     console.error(result.error);
	 *   }
	 * }
	 *
	 * main();
	 * ```
	 */
	/* v8 ignore start - build execution requires actual rsbuild bundling */
	async build(): Promise<GitHubActionBuildResult> {
		try {
			const config = await this.loadConfig();
			let validationResult: ValidationResult | undefined;

			if (!this.skipValidation) {
				validationResult = await this.validate();
				if (!validationResult.valid) {
					return {
						success: false,
						validation: validationResult,
						error: "Validation failed",
					};
				}
			}

			const cwd = this.cwd;
			const clean = this.clean;

			const program = Effect.gen(function* () {
				const buildService = yield* BuildService;
				const buildOptions: BuildRunnerOptions = {
					cwd,
					clean,
				};
				return yield* buildService.build(config, buildOptions);
			});

			const buildResult = await this.runtime.runPromise(program);

			if (!buildResult.success) {
				if (validationResult) {
					return {
						success: false,
						build: buildResult,
						validation: validationResult,
						error: buildResult.error ?? "Build failed",
					};
				}
				return {
					success: false,
					build: buildResult,
					error: buildResult.error ?? "Build failed",
				};
			}

			// Persist locally if enabled
			let persistLocalResult: PersistLocalResult | undefined;
			if (config.persistLocal.enabled) {
				const persistProgram = Effect.gen(function* () {
					const persistLocalService = yield* PersistLocalService;
					return yield* persistLocalService.persist(config, { cwd });
				});
				persistLocalResult = await this.runtime.runPromise(persistProgram);
			}

			if (validationResult) {
				return {
					success: true,
					build: buildResult,
					validation: validationResult,
					persistLocal: persistLocalResult,
				};
			}
			return {
				success: true,
				build: buildResult,
				persistLocal: persistLocalResult,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				cause: error,
			};
		}
	}
	/* v8 ignore stop */

	/**
	 * Dispose the runtime and release resources.
	 *
	 * @remarks
	 * Call this when you're done using the GitHubAction instance
	 * to clean up any resources held by the Effect runtime.
	 */
	/* v8 ignore next 3 - cleanup method */
	async dispose(): Promise<void> {
		await this.runtime.dispose();
	}
}

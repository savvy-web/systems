/**
 * Configuration schemas for GitHub Action Builder using Effect Schema.
 *
 * @remarks
 * This module defines the schemas for validating configuration
 * and provides the {@link defineConfig} helper for type-safe configuration files.
 *
 * @internal
 */
import { Schema } from "effect";

// =============================================================================
// Entry Point Schema
// =============================================================================

/**
 * Schema for entry point paths.
 *
 * @remarks
 * GitHub Actions support three entry points:
 * - `main`: The primary action entry point (required)
 * - `pre`: Runs before the main action (optional)
 * - `post`: Runs after the main action for cleanup (optional)
 *
 * @internal
 */
export const EntriesSchema = Schema.Struct({
	/** Path to the main action entry point. Defaults to "src/main.ts". */
	main: Schema.optionalWith(Schema.String, { default: () => "src/main.ts" }),
	/** Path to the pre-action hook entry point. */
	pre: Schema.optional(Schema.String),
	/** Path to the post-action hook entry point. */
	post: Schema.optional(Schema.String),
});

/**
 * Entry point paths configuration.
 *
 * @public
 */
export type Entries = typeof EntriesSchema.Type;

// =============================================================================
// Build Options Schema
// =============================================================================

/**
 * Schema for build options.
 *
 * @remarks
 * Build options control how the TypeScript source is bundled using rsbuild.
 * The bundler creates a single JavaScript file with all dependencies inlined.
 *
 * @internal
 */
export const BuildOptionsSchema = Schema.Struct({
	/** Enable minification to reduce bundle size. Defaults to true. */
	minify: Schema.optionalWith(Schema.Boolean, { default: () => true }),
	/** Generate source maps for debugging. Defaults to false. */
	sourceMap: Schema.optionalWith(Schema.Boolean, { default: () => false }),
	/** Packages to exclude from the bundle (in addition to node: builtins). Defaults to []. */
	externals: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
	/** Packages to exclude from the bundle and replace with a stub that throws if loaded at runtime. Use for optional transitive dependencies the action never exercises (e.g. native modules). Defaults to []. */
	ignore: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
});

/**
 * Build options for the bundler.
 *
 * @public
 */
export type BuildOptions = typeof BuildOptionsSchema.Type;

// =============================================================================
// Validation Options Schema
// =============================================================================

/**
 * Schema for validation options.
 *
 * @remarks
 * Validation options control how strictly the build process validates
 * the project structure and configuration before building.
 *
 * @internal
 */
export const ValidationOptionsSchema = Schema.Struct({
	/** Require action.yml to exist and be valid. Defaults to true. */
	requireActionYml: Schema.optionalWith(Schema.Boolean, { default: () => true }),
	/** Maximum bundle size before warning/error (e.g., "5mb", "500kb"). */
	maxBundleSize: Schema.optional(Schema.String),
	/** Treat warnings as errors. Auto-detects from CI when undefined. */
	strict: Schema.optional(Schema.Boolean),
});

/**
 * Validation options for the build process.
 *
 * @public
 */
export type ValidationOptions = typeof ValidationOptionsSchema.Type;

// =============================================================================
// Persist Local Options Schema
// =============================================================================

/**
 * Schema for persist-local options.
 *
 * @remarks
 * Controls automatic copying of build output to a local action directory
 * for testing with nektos/act.
 *
 * @internal
 */
export const PersistLocalOptionsSchema = Schema.Struct({
	/** Enable persisting build output locally. Defaults to true. */
	enabled: Schema.optionalWith(Schema.Boolean, { default: () => true }),
	/** Path for the local action directory, relative to cwd. Defaults to ".github/actions/local". */
	path: Schema.optionalWith(Schema.String, { default: () => ".github/actions/local" }),
	/** Generate act boilerplate files (.actrc, act-test.yml) if they don't exist. Defaults to true. */
	actTemplate: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});

/**
 * Persist-local options for copying build output.
 *
 * @public
 */
export type PersistLocalOptions = typeof PersistLocalOptionsSchema.Type;

// =============================================================================
// Config Input Schema (User-provided, all optional)
// =============================================================================

/**
 * User-provided configuration input (all fields optional).
 *
 * @remarks
 * This schema is used for parsing user-provided configuration.
 * All sections are optional; defaults are applied via {@link defineConfig}.
 *
 * @internal
 */
export const ConfigInputSchema = Schema.Struct({
	entries: Schema.optional(
		Schema.Struct({
			main: Schema.optional(Schema.String),
			pre: Schema.optional(Schema.String),
			post: Schema.optional(Schema.String),
		}),
	),
	build: Schema.optional(
		Schema.Struct({
			minify: Schema.optional(Schema.Boolean),
			sourceMap: Schema.optional(Schema.Boolean),
			externals: Schema.optional(Schema.Array(Schema.String)),
			ignore: Schema.optional(Schema.Array(Schema.String)),
		}),
	),
	validation: Schema.optional(
		Schema.Struct({
			requireActionYml: Schema.optional(Schema.Boolean),
			maxBundleSize: Schema.optional(Schema.String),
			strict: Schema.optional(Schema.Boolean),
		}),
	),
	persistLocal: Schema.optional(
		Schema.Struct({
			enabled: Schema.optional(Schema.Boolean),
			path: Schema.optional(Schema.String),
			actTemplate: Schema.optional(Schema.Boolean),
		}),
	),
});

/**
 * User-provided configuration input (all fields optional).
 *
 * @remarks
 * Use this type when accepting configuration from users.
 * All fields are optional and will be merged with defaults.
 *
 * @public
 */
export type ConfigInput = typeof ConfigInputSchema.Type;

// =============================================================================
// Config Schema (Fully resolved)
// =============================================================================

/**
 * Fully resolved configuration with all defaults applied.
 *
 * @internal
 */
export const ConfigSchema = Schema.Struct({
	entries: EntriesSchema,
	build: BuildOptionsSchema,
	validation: ValidationOptionsSchema,
	persistLocal: PersistLocalOptionsSchema,
});

/**
 * Fully resolved configuration with all defaults applied.
 *
 * @remarks
 * This type represents the final configuration after all defaults
 * have been applied. It is the result of calling {@link defineConfig}.
 *
 * @public
 */
export type Config = typeof ConfigSchema.Type;

// =============================================================================
// defineConfig Helper
// =============================================================================

/**
 * Define a configuration with full TypeScript support.
 *
 * @remarks
 * This function validates the configuration and applies all defaults.
 * Use it in your `action.config.ts` file for autocomplete and type checking.
 *
 * @param config - Partial configuration object
 * @returns Fully resolved configuration with defaults applied
 *
 * @example Basic configuration file
 * ```typescript
 * // action.config.ts
 * import { defineConfig } from "@savvy-web/github-action-builder";
 *
 * export default defineConfig({
 *   entries: {
 *     main: "src/main.ts",
 *   },
 *   build: {
 *     minify: true,
 *   },
 * });
 * ```
 *
 * @example Full configuration with all options
 * ```typescript
 * // action.config.ts
 * import { defineConfig } from "@savvy-web/github-action-builder";
 *
 * export default defineConfig({
 *   entries: {
 *     main: "src/action.ts",
 *     pre: "src/setup.ts",
 *     post: "src/cleanup.ts",
 *   },
 *   build: {
 *     minify: true,
 *     sourceMap: true,
 *     externals: ["@aws-sdk/client-s3"],
 *     ignore: ["libxmljs2"],
 *   },
 *   validation: {
 *     requireActionYml: true,
 *     maxBundleSize: "10mb",
 *     strict: true,
 *   },
 * });
 * ```
 *
 * @public
 */
export function defineConfig(config: Partial<ConfigInput> = {}): Config {
	// Use Schema.decodeUnknownSync to apply defaults from the schema
	return Schema.decodeUnknownSync(ConfigSchema)({
		entries: config.entries ?? {},
		build: config.build ?? {},
		validation: config.validation ?? {},
		persistLocal: config.persistLocal ?? {},
	});
}

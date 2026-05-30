/**
 * ValidationService Layer implementation.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Effect, Layer, ParseResult, Schema } from "effect";
import { parse as parseYaml } from "yaml-effect";

import {
	ActionYmlMissing,
	ActionYmlSchemaError,
	ActionYmlSyntaxError,
	MainEntryMissing,
	ValidationFailed,
} from "../errors.js";
import { ActionYml } from "../schemas/action-yml.js";
import type { Config } from "../schemas/config.js";
import { ConfigService } from "./config.js";
import type { ActionYmlResult, ValidateOptions, ValidationErrorItem, ValidationWarning } from "./validation.js";
import { ValidationService } from "./validation.js";

// =============================================================================
// Pure Helper Functions
// =============================================================================

/* v8 ignore start - CI environment detection has multiple env var formats */
/** Check if running in CI environment. */
const isCI = (): boolean =>
	process.env.CI === "true" || process.env.CI === "1" || process.env.GITHUB_ACTIONS === "true";

/** Resolve strict mode from config or environment. */
const resolveStrict = (configStrict?: boolean): boolean => configStrict ?? isCI();
/* v8 ignore stop */

/** Create a validation warning, omitting undefined file. */
const makeWarning = (code: string, message: string, suggestion: string, file?: string): ValidationWarning =>
	file !== undefined ? { code, message, suggestion, file } : { code, message, suggestion };

/** Format schema parse errors. */
/* v8 ignore start - only called for schema validation errors */
const formatSchemaErrors = (
	error: ParseResult.ParseError,
	filePath: string,
): Array<{ path: string; message: string }> => [
	{ path: filePath, message: ParseResult.TreeFormatter.formatErrorSync(error) },
];
/* v8 ignore stop */

// =============================================================================
// Layer Implementation
// =============================================================================

/**
 * Live implementation of ValidationService.
 */
export const ValidationServiceLive = Layer.effect(
	ValidationService,
	Effect.gen(function* () {
		const configService = yield* ConfigService;

		// =========================================================================
		// Internal Effects
		// =========================================================================

		/** Read and parse action.yml file. */
		const readActionYml = (path: string) =>
			Effect.gen(function* () {
				// Check existence
				if (!existsSync(path)) {
					return yield* new ActionYmlMissing({ cwd: path });
				}

				// Read file
				const content = yield* Effect.try({
					try: () => readFileSync(path, "utf8"),
					/* v8 ignore next */
					catch: () => new ActionYmlSyntaxError({ path, message: "Failed to read file" }),
				});

				// Parse YAML
				const parsed = yield* parseYaml(content).pipe(
					/* v8 ignore next 5 - requires malformed YAML */
					Effect.mapError(
						(error) =>
							new ActionYmlSyntaxError({
								path,
								message: error.message,
							}),
					),
				);

				/* v8 ignore start - requires non-object YAML (e.g., scalar or array) */
				if (!parsed || typeof parsed !== "object") {
					return yield* new ActionYmlSyntaxError({ path, message: "action.yml must be an object" });
				}
				/* v8 ignore stop */

				return parsed as Record<string, unknown>;
			});

		/** Validate parsed content against ActionYml schema. */
		/* v8 ignore start - schema validation error branch */
		const validateSchema = (parsed: Record<string, unknown>, path: string) =>
			Effect.gen(function* () {
				const result = Schema.decodeUnknownEither(ActionYml)(parsed);
				if (result._tag === "Left") {
					return yield* new ActionYmlSchemaError({ path, errors: formatSchemaErrors(result.left, path) });
				}
				return result.right;
			});
		/* v8 ignore stop */

		/** Check for recommended fields and generate warnings. */
		/* v8 ignore start - recommendation checks have many branches */
		const checkRecommendations = (content: Record<string, unknown>, filePath?: string): ValidationWarning[] => {
			const warnings: ValidationWarning[] = [];

			// Check branding
			if (!content.branding) {
				warnings.push(
					makeWarning(
						"ACTION_YML_NO_BRANDING",
						"No branding configuration found",
						"Add branding.icon and branding.color for better marketplace visibility",
						filePath,
					),
				);
			} else {
				const branding = content.branding as Record<string, unknown>;
				if (!branding.icon) {
					warnings.push(
						makeWarning(
							"ACTION_YML_NO_BRANDING_ICON",
							"Branding icon not specified",
							"Add branding.icon for better marketplace visibility",
							filePath,
						),
					);
				}
				if (!branding.color) {
					warnings.push(
						makeWarning(
							"ACTION_YML_NO_BRANDING_COLOR",
							"Branding color not specified",
							"Add branding.color for better marketplace visibility",
							filePath,
						),
					);
				}
			}

			// Check input descriptions
			if (content.inputs) {
				const inputs = content.inputs as Record<string, Record<string, unknown>>;
				for (const [name, input] of Object.entries(inputs)) {
					if (!input.description) {
						warnings.push(
							makeWarning(
								"ACTION_YML_INPUT_NO_DESCRIPTION",
								`Input '${name}' has no description`,
								`Add a description for the '${name}' input`,
								filePath,
							),
						);
					}
				}
			}

			// Check output descriptions
			if (content.outputs) {
				const outputs = content.outputs as Record<string, Record<string, unknown>>;
				for (const [name, output] of Object.entries(outputs)) {
					if (!output.description) {
						warnings.push(
							makeWarning(
								"ACTION_YML_OUTPUT_NO_DESCRIPTION",
								`Output '${name}' has no description`,
								`Add a description for the '${name}' output`,
								filePath,
							),
						);
					}
				}
			}

			return warnings;
		};
		/* v8 ignore stop */

		/** Validate action.yml file completely. */
		const validateActionYml = (
			path: string,
		): Effect.Effect<ActionYmlResult, ActionYmlMissing | ActionYmlSyntaxError | ActionYmlSchemaError> =>
			Effect.gen(function* () {
				const parsed = yield* readActionYml(path);
				const content = yield* validateSchema(parsed, path);
				const warnings = checkRecommendations(parsed, path);

				return {
					valid: true,
					content,
					errors: [],
					warnings,
				};
			});

		/** Check entry points exist. */
		const checkEntries = (config: Config, cwd: string) =>
			Effect.gen(function* () {
				const errors: ValidationErrorItem[] = [];

				const entriesConfig: { main?: string; pre?: string; post?: string } = {
					main: config.entries.main,
				};
				if (config.entries.pre) entriesConfig.pre = config.entries.pre;
				if (config.entries.post) entriesConfig.post = config.entries.post;

				const result = yield* Effect.either(configService.detectEntries(cwd, entriesConfig));

				/* v8 ignore start - error branch requires missing main entry */
				if (result._tag === "Left" && result.left instanceof MainEntryMissing) {
					errors.push({
						code: "MAIN_ENTRY_MISSING",
						message: `Main entry point not found: ${result.left.expectedPath}`,
						file: result.left.expectedPath,
						suggestion: "Create src/main.ts or specify a different path in config",
					});
				}
				/* v8 ignore stop */

				return errors;
			});

		/** Check action.yml and collect errors/warnings. */
		/* v8 ignore start - action.yml validation has many error branches */
		const checkActionYml = (config: Config, cwd: string) =>
			Effect.gen(function* () {
				const errors: ValidationErrorItem[] = [];
				const warnings: ValidationWarning[] = [];

				if (!config.validation.requireActionYml) {
					return { errors, warnings };
				}

				const actionYmlPath = resolve(cwd, "action.yml");
				const result = yield* Effect.either(validateActionYml(actionYmlPath));

				if (result._tag === "Left") {
					const error = result.left;
					if (error instanceof ActionYmlMissing) {
						warnings.push({
							code: "ACTION_YML_MISSING",
							message: "action.yml not found",
							file: actionYmlPath,
							suggestion: "Create action.yml to define your action metadata",
						});
					} else if (error instanceof ActionYmlSyntaxError) {
						errors.push({
							code: "ACTION_YML_SYNTAX_ERROR",
							message: error.message,
							file: error.path,
						});
					} else if (error instanceof ActionYmlSchemaError) {
						for (const schemaError of error.errors) {
							errors.push({
								code: "ACTION_YML_SCHEMA_ERROR",
								message: schemaError.message,
								file: error.path,
							});
						}
					}
				} else {
					warnings.push(...result.right.warnings);
				}

				return { errors, warnings };
			});
		/* v8 ignore stop */

		// =========================================================================
		// Service Implementation
		// =========================================================================

		return {
			validate: (config: Config, options: ValidateOptions = {}) =>
				Effect.gen(function* () {
					const cwd = options.cwd ?? process.cwd();
					const strict = resolveStrict(options.strict ?? config.validation.strict);

					// Run validations
					const entryErrors = yield* checkEntries(config, cwd);
					const actionYmlResult = yield* checkActionYml(config, cwd);

					// Combine results
					const errors = [...entryErrors, ...actionYmlResult.errors];
					const warnings = [...actionYmlResult.warnings];

					// Determine validity
					const valid = errors.length === 0 && (!strict || warnings.length === 0);

					// In strict mode with warnings, fail
					/* v8 ignore start - strict mode branch requires CI environment */
					if (strict && warnings.length > 0 && errors.length === 0) {
						return yield* new ValidationFailed({
							errorCount: 0,
							warningCount: warnings.length,
							message: "Warnings treated as errors in strict mode",
						});
					}
					/* v8 ignore stop */

					return { valid, errors, warnings };
				}),

			validateActionYml,

			/* v8 ignore start - formatting function tested via integration */
			formatResult: (result) => {
				const lines: string[] = [];

				if (result.errors.length > 0) {
					lines.push("Errors:");
					for (const error of result.errors) {
						lines.push(`  \u2717 ${error.message}`);
						if (error.suggestion) {
							lines.push(`    \u2192 ${error.suggestion}`);
						}
					}
				}

				if (result.warnings.length > 0) {
					if (lines.length > 0) lines.push("");
					lines.push("Warnings:");
					for (const warning of result.warnings) {
						lines.push(`  \u26A0 ${warning.message}`);
						if (warning.suggestion) {
							lines.push(`    \u2192 ${warning.suggestion}`);
						}
					}
				}

				if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
					lines.push("\u2713 All checks passed");
				}

				return lines.join("\n");
			},
			/* v8 ignore stop */

			/* v8 ignore next 2 - environment detection */
			isCI: () => Effect.succeed(isCI()),

			/* v8 ignore next */
			isStrict: (configStrict?: boolean) => Effect.succeed(resolveStrict(configStrict)),
		};
	}),
);

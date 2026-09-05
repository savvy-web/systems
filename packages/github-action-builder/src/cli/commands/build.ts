/* v8 ignore start - CLI commands require integration testing */
/**
 * Build command for GitHub Action Builder CLI.
 */
import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { BuildFailed, ValidationFailed } from "../../errors.js";
import { BuildService } from "../../services/build.js";
import { ConfigService } from "../../services/config.js";
import { PersistLocalService } from "../../services/persist-local.js";
import { ValidationService } from "../../services/validation.js";

/**
 * Config file option - shared across commands.
 */
export const configOption = Flag.file("config").pipe(
	Flag.withAlias("c"),
	Flag.withDescription("Path to configuration file"),
	Flag.optional,
);

/**
 * Quiet mode option - suppress non-error output.
 */
export const quietOption = Flag.boolean("quiet").pipe(
	Flag.withAlias("q"),
	Flag.withDescription("Suppress non-error output"),
	Flag.withDefault(false),
);

/**
 * Skip validation option.
 */
export const noValidateOption = Flag.boolean("no-validate").pipe(
	Flag.withDescription("Skip validation step"),
	Flag.withDefault(false),
);

/**
 * Skip persist-local option.
 */
export const noPersistOption = Flag.boolean("no-persist").pipe(
	Flag.withDescription("Skip persisting build output to local action directory"),
	Flag.withDefault(false),
);

/**
 * Build command handler using Effect services.
 */
const buildHandler = ({
	config,
	quiet,
	noValidate,
	noPersist,
}: {
	config: Option.Option<string>;
	quiet: boolean;
	noValidate: boolean;
	noPersist: boolean;
}) =>
	Effect.gen(function* () {
		const configService = yield* ConfigService;
		const validationService = yield* ValidationService;
		const buildService = yield* BuildService;
		const persistLocalService = yield* PersistLocalService;

		const cwd = process.cwd();

		// Load configuration
		if (!quiet) {
			yield* Console.log("Loading configuration...");
		}

		const loadOptions = Option.isSome(config) ? { cwd, configPath: config.value } : { cwd };
		const configResult = yield* configService.load(loadOptions);

		if (!quiet) {
			if (configResult.usingDefaults) {
				yield* Console.log("  Using default configuration");
			} else {
				yield* Console.log(`  Found ${configResult.configPath}`);
			}
		}

		// Validate (unless skipped)
		if (!noValidate) {
			if (!quiet) {
				yield* Console.log("\nValidating...");
			}

			const validationResult = yield* validationService.validate(configResult.config, { cwd });

			if (!validationResult.valid) {
				yield* Console.error(`\n${validationService.formatResult(validationResult)}`);
				return yield* new ValidationFailed({
					errorCount: validationResult.errors.length,
					warningCount: validationResult.warnings.length,
					message: "Validation failed",
				});
			}

			if (!quiet && validationResult.warnings.length > 0) {
				yield* Console.log(validationService.formatResult(validationResult));
			} else if (!quiet) {
				yield* Console.log("  All checks passed");
			}
		}

		// Build
		if (!quiet) {
			yield* Console.log("\nBuilding...");
		}

		const buildResult = yield* buildService.build(configResult.config, { cwd });

		if (!buildResult.success) {
			yield* Console.error(`\nBuild failed: ${buildResult.error}`);
			return yield* new BuildFailed({
				message: buildResult.error ?? "One or more entries failed to build",
				failedEntries: buildResult.entries.filter((e) => !e.success).length,
			});
		}

		if (!quiet) {
			yield* Console.log(`\n${buildService.formatResult(buildResult)}`);
			yield* Console.log("\nBuild completed successfully!");
		}

		// Persist locally (unless skipped)
		if (!noPersist && configResult.config.persistLocal.enabled) {
			if (!quiet) {
				yield* Console.log("\nPersisting to local action directory...");
			}

			const persistResult = yield* persistLocalService.persist(configResult.config, { cwd });

			if (!quiet && persistResult.success) {
				yield* Console.log(persistLocalService.formatResult(persistResult));
			}
		}
	});

/**
 * Build command - bundles GitHub Action entry points.
 */
export const buildCommand = Command.make(
	"build",
	{
		config: configOption,
		quiet: quietOption,
		noValidate: noValidateOption,
		noPersist: noPersistOption,
	},
	buildHandler,
);

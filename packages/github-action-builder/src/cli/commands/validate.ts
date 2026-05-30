/* v8 ignore start - CLI commands require integration testing */
/**
 * Validate command for GitHub Action Builder CLI.
 */
import { Command } from "@effect/cli";
import { Console, Effect, Option } from "effect";

import { ConfigService } from "../../services/config.js";
import { ValidationService } from "../../services/validation.js";
import { configOption, quietOption } from "./build.js";

/**
 * Validate command handler using Effect services.
 */
const validateHandler = ({ config, quiet }: { config: Option.Option<string>; quiet: boolean }) =>
	Effect.gen(function* () {
		const configService = yield* ConfigService;
		const validationService = yield* ValidationService;

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

		// Validate
		if (!quiet) {
			yield* Console.log("\nValidating...");
		}

		const validationResult = yield* validationService.validate(configResult.config, { cwd });

		// Always show validation results
		yield* Console.log(`\n${validationService.formatResult(validationResult)}`);

		if (!validationResult.valid) {
			return yield* Effect.fail(new Error("Validation failed"));
		}

		if (!quiet) {
			yield* Console.log("\nValidation completed successfully!");
		}
	});

/**
 * Validate command - checks action.yml and configuration.
 */
export const validateCommand = Command.make(
	"validate",
	{
		config: configOption,
		quiet: quietOption,
	},
	validateHandler,
);

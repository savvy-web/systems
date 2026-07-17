/**
 * Validate-file command — validate a single changeset file.
 *
 * Reads one `.md` file and runs the full lint pipeline against it,
 * outputting machine-readable diagnostics. Designed for use in hooks
 * and editor integrations where only one file needs checking.
 *
 * @example
 * ```bash
 * savvy changeset validate-file .changeset/cool-lions-sing.md
 * ```
 *
 * @internal
 */

import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";

const { ChangesetLinter } = Changesets;

/* v8 ignore next */
const fileArg = Argument.file("file");

/**
 * Run lint validation on a single changeset file.
 *
 * Outputs one line per error in `file:line:col rule message` format.
 * Logs "Valid." when the file passes. Sets `process.exitCode = 1`
 * when errors are found or the file cannot be read.
 *
 * @param filePath - Path to the changeset `.md` file
 * @returns An Effect that performs validation and logs results
 *
 * @internal
 */
export function runValidateFile(filePath: string) {
	return Effect.gen(function* () {
		const result = yield* Effect.try(() => ChangesetLinter.validateFile(filePath)).pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					yield* Effect.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
					process.exitCode = 1;
					return null;
				}),
			),
		);

		if (result === null) return;

		for (const msg of result) {
			yield* Effect.log(`${msg.file}:${msg.line}:${msg.column} ${msg.rule} ${msg.message}`);
		}

		if (result.length > 0) {
			process.exitCode = 1;
		} else {
			yield* Effect.log("Valid.");
		}
	});
}

/* v8 ignore next 3 -- CLI registration; handler tested via runValidateFile */
export const validateFileCommand = Command.make("validate-file", { file: fileArg }, ({ file }) =>
	runValidateFile(file),
).pipe(Command.withDescription("Validate a single changeset file"));

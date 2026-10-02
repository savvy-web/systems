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

import { CliExit } from "@effected/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { CommandError } from "../../../internal/command-error.js";
import { Report } from "../../../internal/report.js";

const { ChangesetLinter } = Changesets;

/* v8 ignore next */
const fileArg = Argument.File("file");

/**
 * Run lint validation on a single changeset file.
 *
 * Outputs one line per error in `file:line:col rule message` format.
 * Prints `✓ Valid` when the file passes. Sets exit code 1 through
 * `CliExit.set` when errors are found; fails with a {@link CommandError}
 * (reported on stderr, exit 1) when the file cannot be read.
 *
 * @param filePath - Path to the changeset `.md` file
 * @returns An Effect that performs validation and logs results
 *
 * @internal
 */
export function runValidateFile(filePath: string) {
	return Effect.gen(function* () {
		const result = yield* Effect.try({
			try: () => ChangesetLinter.validateFile(filePath),
			catch: (error) =>
				CommandError.from(error instanceof Error ? error : String(error), {
					message: `could not validate ${filePath}`,
				}),
		});

		if (result.length > 0) {
			// Verbatim, never wrapped: hooks and editors parse each line as `file:line:col rule message`.
			yield* Report.print([
				Report.verbatim(
					result.map((msg) => `${msg.file}:${msg.line}:${msg.column} ${msg.rule} ${msg.message}`).join("\n"),
				),
			]);
			yield* CliExit.set(1);
		} else {
			yield* Report.print([Report.ok("Valid")]);
		}
	});
}

/* v8 ignore next 3 -- CLI registration; handler tested via runValidateFile */
export const validateFileCommand = Command.make("validate-file", { file: fileArg }, ({ file }) =>
	runValidateFile(file),
).pipe(Command.withDescription("Validate a single changeset file"));

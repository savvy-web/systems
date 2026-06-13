/**
 * Lint command -- validate changeset files with machine-readable output.
 *
 * Emits one line per error in `file:line:col rule message` format, suitable
 * for consumption by editors, CI tools, and the `--format` flag of
 * markdownlint-cli2.
 *
 * @remarks
 * The command resolves the directory argument, delegates to
 * {@link ChangesetLinter.validate}, and logs each {@link LintMessage} as a
 * single colon-delimited line. When no errors are found and `--quiet` is not
 * set, a success message is printed. Sets `process.exitCode = 1` when errors
 * are found.
 *
 * @example
 * ```bash
 * savvy changeset lint .changeset
 * savvy changeset lint --quiet .changeset
 * ```
 *
 * @internal
 */

import { resolve } from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Console, Effect } from "effect";

const { ChangesetLinter } = Changesets;

/* v8 ignore start -- CLI option definitions; handler tested via runLint */
const dirArg = Args.directory({ name: "dir" }).pipe(Args.withDefault(".changeset"));

const quietOption = Options.boolean("quiet").pipe(
	Options.withAlias("q"),
	Options.withDescription("Only output errors, no summary"),
	Options.withDefault(false),
);
/* v8 ignore stop */

/**
 * Run machine-readable lint validation on all changeset files in `dir`.
 *
 * Outputs one line per error in `file:line:col rule message` format. Sets
 * `process.exitCode = 1` when one or more errors are found.
 *
 * @param dir - Path to the changeset directory (resolved relative to cwd)
 * @param quiet - When `true`, suppress the "No lint errors found" message
 * @returns An Effect that performs validation and logs results
 *
 * @internal
 */
export function runLint(dir: string, quiet: boolean) {
	return Effect.gen(function* () {
		const resolved = resolve(dir);
		const messages = yield* Effect.try(() => ChangesetLinter.validate(resolved));

		for (const msg of messages) {
			yield* Console.log(`${msg.file}:${msg.line}:${msg.column} ${msg.rule} ${msg.message}`);
		}

		if (!quiet && messages.length === 0) {
			yield* Console.log("No lint errors found.");
		}

		if (messages.length > 0) {
			process.exitCode = 1;
		}
	});
}

/* v8 ignore next 3 -- CLI registration; handler tested via runLint */
export const lintCommand = Command.make("lint", { dir: dirArg, quiet: quietOption }, ({ dir, quiet }) =>
	runLint(dir, quiet),
).pipe(Command.withDescription("Validate changeset files"));

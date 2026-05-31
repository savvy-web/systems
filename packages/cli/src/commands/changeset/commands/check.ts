/**
 * Check command -- full validation pipeline with human-readable output.
 *
 * Runs lint on all changeset files in a directory and reports a grouped
 * summary with pass/fail counts. Unlike the `lint` command, output is
 * formatted for human consumption rather than machine parsing.
 *
 * @remarks
 * The command resolves the directory argument, delegates to
 * {@link ChangesetLinter.validate}, groups the resulting
 * {@link LintMessage} objects by file path, and logs each file's errors
 * indented under the file name. Sets `process.exitCode = 1` when errors
 * are found.
 *
 * @example
 * ```bash
 * savvy changeset check .changeset
 * ```
 *
 * @internal
 */

import { resolve } from "node:path";
import { Args, Command } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";

type LintMessage = Changesets.LintMessage;
const { ChangesetLinter } = Changesets;

/* v8 ignore next */
const dirArg = Args.directory({ name: "dir" }).pipe(Args.withDefault(".changeset"));

/**
 * Run the check validation pipeline on all changeset files in `dir`.
 *
 * Groups lint messages by file and logs a human-readable summary. Sets
 * `process.exitCode = 1` when one or more errors are found.
 *
 * @param dir - Path to the changeset directory (resolved relative to cwd)
 * @returns An Effect that performs validation and logs results
 *
 * @internal
 */
export function runChangesetCheck(dir: string): Effect.Effect<void, Error> {
	return Effect.gen(function* () {
		const resolved = resolve(dir);
		const messages = yield* Effect.try({
			try: () => ChangesetLinter.validate(resolved),
			catch: (e) => new Error(String(e)),
		});

		// Group messages by file
		const byFile = new Map<string, LintMessage[]>();
		for (const msg of messages) {
			const existing = byFile.get(msg.file);
			if (existing) {
				existing.push(msg);
			} else {
				byFile.set(msg.file, [msg]);
			}
		}

		// Log grouped results
		for (const [file, fileMessages] of byFile) {
			yield* Effect.log(`\n${file}`);
			for (const msg of fileMessages) {
				yield* Effect.log(`  ${msg.line}:${msg.column}  ${msg.rule}  ${msg.message}`);
			}
		}

		// Count files checked (all md files, not just those with errors)
		const errorCount = messages.length;
		const filesWithErrors = byFile.size;

		if (errorCount > 0) {
			yield* Effect.log(`\n${filesWithErrors} file(s) with errors, ${errorCount} error(s) found`);
			process.exitCode = 1;
		} else {
			yield* Effect.log("All changeset files passed validation.");
		}
	});
}

/* v8 ignore next 3 -- CLI registration; handler tested via runChangesetCheck */
export const checkCommand = Command.make("check", { dir: dirArg }, ({ dir }) => runChangesetCheck(dir)).pipe(
	Command.withDescription("Full changeset validation with summary"),
);

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
 * indented under the file name. Sets exit code 1 through `CliExit.set` when errors
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
import type { Block } from "@effected/cli";
import { CliExit } from "@effected/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import type { ReportEnv } from "../../../internal/report.js";
import { Report } from "../../../internal/report.js";

type LintMessage = Changesets.LintMessage;
const { ChangesetLinter } = Changesets;

/* v8 ignore next */
const dirArg = Argument.Directory("dir").pipe(Argument.withDefault(".changeset"));

/**
 * Run the check validation pipeline on all changeset files in `dir`.
 *
 * Groups lint messages by file and prints a human-readable report. Sets
 * exit code 1 through `CliExit.set` when one or more errors are found.
 *
 * @param dir - Path to the changeset directory (resolved relative to cwd)
 * @returns An Effect that performs validation and prints the report
 *
 * @internal
 */
export function runChangesetCheck(dir: string): Effect.Effect<void, Error, CliExit | ReportEnv> {
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

		// Report grouped results
		const blocks: Block[] = [];
		for (const [file, fileMessages] of byFile) {
			blocks.push(Report.line(""), Report.heading(file));
			for (const msg of fileMessages) {
				blocks.push(Report.detail(`${msg.line}:${msg.column}  ${msg.rule}  ${msg.message}`));
			}
		}

		// Count files checked (all md files, not just those with errors)
		const errorCount = messages.length;
		const filesWithErrors = byFile.size;

		if (errorCount > 0) {
			blocks.push(Report.line(""), Report.fail(`${filesWithErrors} file(s) with errors, ${errorCount} error(s) found`));
			yield* Report.print(blocks);
			yield* CliExit.set(1);
		} else {
			blocks.push(Report.ok("All changeset files passed validation"));
			yield* Report.print(blocks);
		}
	});
}

/* v8 ignore next 3 -- CLI registration; handler tested via runChangesetCheck */
export const checkCommand = Command.make("check", { dir: dirArg }, ({ dir }) => runChangesetCheck(dir)).pipe(
	Command.withDescription("Full changeset validation with summary"),
);

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
 * {@link LintMessage} objects by file path, and prints one section per file
 * (titled by the file, its findings as a position/rule/message table) plus a
 * GitHub Actions error annotation per finding, which only the Actions log
 * renders. Sets exit code 1 through `CliExit.set` when errors
 * are found.
 *
 * @example
 * ```bash
 * savvy changeset check .changeset
 * ```
 *
 * @internal
 */

import { isAbsolute, relative, resolve } from "node:path";
import type { Block } from "@effected/cli";
import { CliExit, Doc } from "@effected/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import type { ReportEnv } from "../../../internal/report.js";
import { Report } from "../../../internal/report.js";
import type { CheckSection } from "../../check-section.js";

type LintMessage = Changesets.LintMessage;
const { ChangesetLinter } = Changesets;

/** The title `savvy check` gives this section. */
const SECTION_TITLE = "changesets";

/** The columns of a file's findings table. */
const FINDING_COLUMNS = [{ header: "position" }, { header: "rule" }, { header: "message" }] as const;

/**
 * A finding's file as the report and the runner show it: relative to the
 * working directory when it lies under it (what a GitHub Actions annotation
 * resolves against the workspace), absolute otherwise.
 */
const displayPath = (cwd: string, file: string): string => {
	const rel = relative(cwd, file);
	return rel === "" || rel.startsWith("..") || isAbsolute(rel) ? file : rel;
};

/* v8 ignore next */
const dirArg = Argument.Directory("dir").pipe(Argument.withDefault(".changeset"));

/**
 * The changeset check as a {@link CheckSection}: its blocks and verdict,
 * unprinted, for `savvy check` to fold into its one document.
 *
 * @remarks
 * One titled section per file with errors (its findings as a
 * position/rule/message table), each followed by one GitHub Actions error
 * annotation per finding, then the summary line. The annotations sit at the
 * top level of `blocks`, not inside the file sections: the kit draws an
 * annotation only at the top level, as a top-level section's child, or as a
 * direct child of a group's body, so this placement survives the caller
 * wrapping `blocks` in a collapsible.
 *
 * @param dir - Path to the changeset directory (resolved relative to cwd)
 * @returns The section; `verdict` is `failure` when any file has errors
 *
 * @internal
 */
export function changesetCheckSection(dir: string): Effect.Effect<CheckSection, Error> {
	return Effect.gen(function* () {
		const resolved = resolve(dir);
		const messages = yield* Effect.try({
			try: () => ChangesetLinter.validate(resolved),
			catch: (e) => new Error(String(e)),
		});

		const byFile = new Map<string, LintMessage[]>();
		for (const msg of messages) {
			const existing = byFile.get(msg.file);
			if (existing) {
				existing.push(msg);
			} else {
				byFile.set(msg.file, [msg]);
			}
		}

		if (messages.length === 0) {
			return {
				title: SECTION_TITLE,
				blocks: [Report.ok("All changeset files passed validation")],
				verdict: "success",
				fixedByInit: false,
			};
		}

		const cwd = resolve();
		const blocks: Block[] = [];
		for (const [file, fileMessages] of byFile) {
			const display = displayPath(cwd, file);
			blocks.push(
				Doc.section(Doc.file(display), [
					Doc.table(
						FINDING_COLUMNS,
						fileMessages.map((msg) => [`${msg.line}:${msg.column}`, msg.rule, msg.message]),
					),
				]),
				...fileMessages.map((msg) =>
					Doc.annotation(
						{ level: "error", file: display, line: msg.line, col: msg.column, title: msg.rule },
						msg.message,
					),
				),
			);
		}
		blocks.push(Report.fail(`${byFile.size} file(s) with errors, ${messages.length} error(s) found`));
		return { title: SECTION_TITLE, blocks, verdict: "failure", fixedByInit: false };
	});
}

/**
 * Run the check validation pipeline on all changeset files in `dir` and
 * print {@link changesetCheckSection}'s blocks (no title heading: the
 * standalone `savvy changeset check` output). Sets exit code 1 through
 * `CliExit.set` when one or more errors are found.
 *
 * @param dir - Path to the changeset directory (resolved relative to cwd)
 * @returns An Effect that performs validation and prints the report
 *
 * @internal
 */
export function runChangesetCheck(dir: string): Effect.Effect<void, Error, CliExit | ReportEnv> {
	return Effect.gen(function* () {
		const section = yield* changesetCheckSection(dir);
		yield* Report.print(section.blocks);
		if (section.verdict === "failure") yield* CliExit.set(1);
	});
}

/* v8 ignore next 3 -- CLI registration; handler tested via runChangesetCheck */
export const checkCommand = Command.make("check", { dir: dirArg }, ({ dir }) => runChangesetCheck(dir)).pipe(
	Command.withDescription("Full changeset validation with summary"),
);

/**
 * `savvy lint text` — fail when a source file is not grep-visible text.
 *
 * @remarks
 * A NUL byte or invalid UTF-8 makes `grep`/`rg` silently skip a file, so a
 * search returns a false negative instead of an error (savvy-web/systems#388).
 * With file arguments the command checks those files (the lint-staged path,
 * `Lint.TextFiles.create`); with none it checks every git-tracked file matching
 * `Lint.TextFiles.glob`. `--staged` reads each file's bytes from the git
 * index instead of the working tree — what the lint-staged handler passes, so
 * a concurrent Biome `--write` on the worktree cannot race the read, and the
 * check sees exactly what the commit records. The classification itself lives in silk-effects, so
 * this command and the lint-staged handler cannot drift.
 *
 * @example
 * ```bash
 * savvy lint text                  # every tracked source/text file
 * savvy lint text src/a.ts docs/b.md
 * savvy lint text --staged src/a.ts   # the index copy, as lint-staged runs it
 * ```
 *
 * @internal
 */

import { CliExit } from "@effected/cli";
import { Lint } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Report } from "../../internal/report.js";

/* v8 ignore start -- CLI option definitions */
const filesArg = Argument.File("files", { mustExist: true }).pipe(
	Argument.withDescription("Files to check; omit to check every git-tracked source/text file"),
	Argument.variadic(),
);
const stagedFlag = Flag.Boolean("staged").pipe(
	Flag.withDescription("Read each file's staged content from the git index instead of the working tree"),
	Flag.withDefault(false),
);
/* v8 ignore stop */

/** Options for {@link runLintText}. */
export interface RunLintTextOptions {
	/** Directory the no-argument mode lists tracked files from. Defaults to `"."`. */
	readonly cwd?: string;
	/** Read each file from the git index instead of the working tree. */
	readonly staged?: boolean;
}

/**
 * Check `files` (or, when empty, every tracked file under `cwd`) and print one
 * line per finding; any finding sets exit code 1. Under `--staged`, every file
 * is still checked when one has no index entry: that file's read error is
 * logged to stderr, counted as failed, and also sets exit code 1. Exported for
 * tests.
 *
 * @internal
 */
export const runLintText = (files: ReadonlyArray<string>, options: RunLintTextOptions = {}) =>
	Effect.gen(function* () {
		const staged = options.staged ?? false;
		const targets = files.length > 0 ? files : yield* Lint.TextFiles.listTracked(options.cwd ?? ".", { staged });
		const { findings, unreadable } = staged
			? yield* Lint.TextFiles.checkStagedFiles(targets)
			: { findings: yield* Lint.TextFiles.checkFiles(targets), unreadable: [] };

		// A file with no index entry cannot be checked under --staged: a
		// diagnostic, so stderr — the findings stay on stdout.
		for (const error of unreadable) {
			yield* Effect.logError(error.message);
		}

		if (findings.length === 0 && unreadable.length === 0) {
			yield* Report.print([
				Report.ok(`${targets.length} ${targets.length === 1 ? "file is" : "files are"} grep-visible text`),
			]);
			return findings;
		}

		const failedFiles = new Set([...findings.map((finding) => finding.path), ...unreadable.map((error) => error.path)])
			.size;
		yield* Report.print([
			...findings.map((finding) => Report.fail(`${finding.location}  ${finding.message}`)),
			Report.summary({ ok: targets.length - failedFiles, fail: failedFiles }),
		]);
		yield* CliExit.set(1);
		return findings;
	});

/** The `savvy lint text` subcommand. */
export const textCommand = Command.make("text", { files: filesArg, staged: stagedFlag }, ({ files, staged }) =>
	runLintText(files, { staged }),
).pipe(Command.withDescription("Fail when a source file contains a NUL byte or is not valid UTF-8 (grep-invisible)"));

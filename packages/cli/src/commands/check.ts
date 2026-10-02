/**
 * Unified `savvy check` orchestrator.
 *
 * @remarks
 * Runs all three tool checks — changeset, commit, lint — sequentially. Unlike
 * the `init` orchestrator, check MUST NOT short-circuit: every check runs and
 * reports in one pass, and only then is the first step failure re-raised.
 *
 * Each step returns a {@link CheckSection}; this orchestrator prints them
 * as ONE document: a collapsible per tool (a `::group::` under GitHub Actions), a summary of the
 * three verdicts, and a `savvy init` tip when a section `savvy init` would fix
 * is not clean. Any finding sets exit code 1.
 *
 * @internal
 */

import type { Block } from "@effected/cli";
import { CliExit, Doc } from "@effected/cli";
import { Effect, Result } from "effect";
import { Command, Flag } from "effect/cli";
import type { ReportEnv } from "../internal/report.js";
import { Report } from "../internal/report.js";
import { changesetCheckSection } from "./changeset/index.js";
import type { CheckSection, CheckVerdict } from "./check-section.js";
import { commitCheckSection } from "./commit/check.js";
import { lintCheckSection } from "./lint/check.js";

// ---------------------------------------------------------------------------
// Default option values
// ---------------------------------------------------------------------------

const DEFAULT_CHANGESET_DIR = ".changeset";

// ---------------------------------------------------------------------------
// CLI option definitions
// ---------------------------------------------------------------------------

/* v8 ignore start -- CLI option definitions; orchestration logic tested via runCheck */
const changesetDirOption = Flag.String("changeset-dir").pipe(
	Flag.withDescription("Path to the changeset directory"),
	Flag.withDefault(DEFAULT_CHANGESET_DIR),
);

const quietOption = Flag.Boolean("quiet").pipe(
	Flag.withAlias("q"),
	Flag.withDescription("Only output warnings from lint check"),
	Flag.withDefault(false),
);
/* v8 ignore stop */

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the three checks without short-circuiting and print them as one
 * document.
 *
 * @remarks
 * Each step builds a {@link CheckSection}; each section is folded into a
 * collapsible (a `::group::` under GitHub Actions, whose body is where a
 * section's annotations are written, so its blocks are never nested deeper).
 * A step that fails still lets the others run and report; the first failure
 * is re-raised after the document is printed.
 *
 * @param steps - The three step Effects. Injected for testability.
 * @returns An Effect that prints the report and sets exit code 1 on any
 *   finding, or fails with the first failing step's error.
 */
export function runCheck<EChangeset, RChangeset, ECommit, RCommit, ELint, RLint>(steps: {
	changeset: Effect.Effect<CheckSection, EChangeset, RChangeset>;
	commit: Effect.Effect<CheckSection, ECommit, RCommit>;
	lint: Effect.Effect<CheckSection, ELint, RLint>;
}): Effect.Effect<void, EChangeset | ECommit | ELint, RChangeset | RCommit | RLint | CliExit | ReportEnv> {
	return Effect.gen(function* () {
		const sections: ReadonlyArray<readonly [string, Result.Result<CheckSection, EChangeset | ECommit | ELint>]> = [
			["changesets", yield* Effect.result(steps.changeset)],
			["commitlint", yield* Effect.result(steps.commit)],
			["lint-staged", yield* Effect.result(steps.lint)],
		];

		const blocks: Array<Block> = [];
		const verdicts: Array<CheckVerdict> = [];
		let initFixes = false;
		for (const [title, result] of sections) {
			if (Result.isFailure(result)) {
				verdicts.push("failure");
				blocks.push(Report.fail(`${title}: the check could not run`));
				continue;
			}
			const section = result.success;
			verdicts.push(section.verdict);
			initFixes ||= section.fixedByInit;
			// An empty body (a clean `--quiet` lint run) has nothing to fold.
			if (section.blocks.length > 0) blocks.push(Doc.collapsible(section.title, section.blocks), Report.line(""));
		}

		const count = (verdict: CheckVerdict) => verdicts.filter((v) => v === verdict).length;
		blocks.push(Report.summary({ ok: count("success"), warn: count("warning"), fail: count("failure") }));
		if (initFixes) {
			blocks.push(Doc.callout("tip", [Doc.paragraph("run savvy init to install or update the missing pieces")]));
		}
		yield* Report.print(blocks);

		if (verdicts.includes("failure")) yield* CliExit.set(1);
		for (const [, result] of sections) {
			if (Result.isFailure(result)) return yield* Effect.fail(result.failure);
		}
	});
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

/* v8 ignore start -- CLI registration; orchestration logic tested via runCheck */
const _checkCommand = Command.make("check", { changesetDir: changesetDirOption, quiet: quietOption }, (opts) =>
	runCheck({
		changeset: changesetCheckSection(opts.changesetDir),
		commit: commitCheckSection(),
		lint: lintCheckSection({ quiet: opts.quiet }),
	}),
).pipe(Command.withDescription("Validate all Silk Suite tool configurations in one pass"));
/* v8 ignore stop */

/**
 * The `savvy check` command for use in the Task B7 root assembly.
 *
 * @remarks
 * Typed with `any` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types. Task B7 should use this via
 * `Command.withSubcommands([checkCommand as never])` or re-infer the type.
 */
export const checkCommand = _checkCommand;

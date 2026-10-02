/**
 * The one error a command fails with when it cannot do what it was asked.
 *
 * @packageDocumentation
 */

import type { Block, CliDocSource, Document } from "@effected/cli";
import { CliDoc, Doc, Status } from "@effected/cli";
import { Data } from "effect";

import { FailureLine } from "./failure-line.js";

/** What {@link CommandError} carries besides its tag. */
export interface CommandErrorFields {
	/** One line saying what failed, e.g. `could not read .changeset/config.json`. */
	readonly message: string;
	/** Supporting lines under the message: what was found, which files, the underlying error. */
	readonly detail?: ReadonlyArray<string> | undefined;
	/** What to do about it, drawn as a tip callout. */
	readonly hint?: string | undefined;
	/** The error this one stands for, kept as `Error.cause` for diagnostics; never drawn. */
	readonly cause?: unknown;
}

/** Options for {@link CommandError.from}. */
export interface CommandErrorFromOptions {
	/** One line saying what failed, in the command's words. */
	readonly message: string;
	/** Lines drawn before the foreign error's own description. */
	readonly detail?: ReadonlyArray<string> | undefined;
	/** What to do about it. */
	readonly hint?: string | undefined;
}

/**
 * A command's failure that draws itself: a failure status line, indented
 * detail lines, and an optional remediation as a tip callout.
 *
 * @remarks
 * Replaces the `Effect.logError(...)` + `CliExit.set(1)` pair: fail with it
 * and `CliRuntime.main` reports it on stderr through `FailureLine.render`,
 * which hands an error implementing `CliDoc` the kit's report of its
 * document, rendered for the run's audience (ANSI for a person, plain for an
 * agent, a GitHub Actions log under Actions). It is a typed failure, so the
 * run exits `1`. A finding (a lint problem, a dirty repo) is still output
 * plus `CliExit.set(1)`, never this.
 *
 * Map a silk-effects error at the command edge with
 * {@link CommandError.from}, inside the handler's `catchTag`s.
 *
 * @example
 * ```ts
 * Effect.catchTag("ChangesetConfigError", (error) =>
 *   Effect.fail(CommandError.from(error, { message: "could not read the changeset config", hint: "run savvy init" })),
 * )
 * ```
 *
 * @internal
 */
export class CommandError extends Data.TaggedError("CommandError")<CommandErrorFields> implements CliDocSource {
	/** Wrap a foreign (silk-effects, kit) error: its own description becomes the last detail line, and it is kept as `cause`. */
	static readonly from = (error: unknown, options: CommandErrorFromOptions): CommandError => {
		const own = FailureLine.describe(error);
		const detail = [...(options.detail ?? []), ...(own === options.message ? [] : [own])];
		return new CommandError({
			message: options.message,
			cause: error,
			...(detail.length > 0 ? { detail } : {}),
			...(options.hint === undefined ? {} : { hint: options.hint }),
		});
	};

	[CliDoc](): Document {
		const head = Doc.line([Doc.status(Status.core, "failure"), " ", this.message]);
		const detail: ReadonlyArray<Block> =
			this.detail === undefined || this.detail.length === 0
				? []
				: [Doc.lines(this.detail.map((line) => Doc.text(`  ${line}`, "muted")))];
		const hint: ReadonlyArray<Block> = this.hint === undefined ? [] : [Doc.callout("tip", [Doc.paragraph(this.hint)])];
		return [head, ...detail, ...hint];
	}
}

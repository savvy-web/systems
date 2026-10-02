/**
 * Asking a person before a command destroys something.
 *
 * @packageDocumentation
 */

import type { Cancelled, CliTheme } from "@effected/cli";
import { CliUi, Confirm } from "@effected/cli/ui";
import { Effect } from "effect";
import { Flag } from "effect/cli";

/** Options for {@link confirmDestructive}. */
export interface ConfirmDestructiveOptions {
	/** The question, e.g. `Remove 3 vendored repos?`. */
	readonly message: string;
	/** The parsed `--yes` ({@link yesFlag}): `true` answers yes without asking. */
	readonly yes: boolean;
}

/**
 * `--yes` / `-y`: answer yes to a destructive command's confirmation.
 *
 * @remarks
 * Defaults to `false` explicitly — core's `Flag.Boolean` has no implicit
 * `false`, so an omitted boolean would otherwise be a usage error. Add it to a
 * command's flags as `yes: yesFlag` and pass the parsed value to
 * {@link confirmDestructive}.
 *
 * @internal
 */
export const yesFlag: Flag.Flag<boolean> = Flag.Boolean("yes").pipe(
	Flag.withAlias("y"),
	Flag.withDescription("Answer yes to the confirmation and proceed"),
	Flag.withDefault(false),
);

/**
 * Whether a destructive command may proceed.
 *
 * @remarks
 * - `yes` (the `--yes` flag) → `true`, without asking.
 * - A run that cannot prompt (`CliInteractive` false: an agent, CI, a pipe,
 *   `TERM=dumb`) → `true`, without asking and without loading Ink or React:
 *   savvy has always proceeded there, and an agent or a script has no one to
 *   ask.
 * - A person at a terminal → the kit's `Confirm` screen (`Enter` alone answers
 *   no). Its answer is a whole `{ confirmed, toggles }`, of which this
 *   returns `confirmed`.
 *
 * Esc, `q` or Ctrl-C on the screen fails with the kit's `Cancelled`, which
 * `CliRuntime.main` reports as one line with exit `130`; a handler that wants
 * cancel to mean "no" catches it with `Effect.catchTag("Cancelled", ...)`.
 * A `false` answer is the handler's to report (a line saying nothing was
 * changed) — it is not a failure.
 *
 * @example
 * ```ts
 * if (!(yield* confirmDestructive({ message: `Remove ${name}?`, yes }))) {
 *   return yield* Report.print([Report.skip(`${name} kept`)]);
 * }
 * ```
 *
 * @internal
 */
export const confirmDestructive = (options: ConfirmDestructiveOptions): Effect.Effect<boolean, Cancelled, CliTheme> =>
	options.yes
		? Effect.succeed(true)
		: CliUi.prompt(Confirm.screen({ message: options.message }), {
				otherwise: { confirmed: true, toggles: {} },
			}).pipe(
				Effect.map((result) => result.confirmed),
				// `prompt` answers `otherwise` when the run cannot prompt, so it never fails this way.
				Effect.catchTag("NotInteractive", () => Effect.succeed(true)),
			);

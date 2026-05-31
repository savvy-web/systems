import { Command } from "@effect/cli";

import { checkCommand } from "./check.js";
import { fmtCommand } from "./fmt.js";
import { initCommand } from "./init.js";

/* v8 ignore start -- CLI registration; each command tested via exported handler */
const _lintCommand = Command.make("lint").pipe(
	Command.withSubcommands([initCommand, checkCommand, fmtCommand]),
	Command.withDescription("Code-quality: lint-staged config, checks, and in-place formatting"),
);

/**
 * The `savvy lint` command group for use in Task B7 root assembly.
 *
 * @remarks
 * Typed as `unknown` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types. Task B7 should import and use this directly
 * as `Command.withSubcommands([lintCommand])` — the cast is for declaration emit only.
 */
// biome-ignore lint/suspicious/noExplicitAny: Effect Command type infers unexportable internal types from effect
export const lintCommand: Command.Command<"lint", any, any, any> = _lintCommand as Command.Command<
	"lint",
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any
>;
/* v8 ignore stop */

// Re-export named handlers for B5/B6 orchestrator consumption.
export { runLintCheck } from "./check.js";
export { runLintInit } from "./init.js";

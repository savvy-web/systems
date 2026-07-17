import { Command } from "effect/unstable/cli";

import { fmtCommand } from "./fmt.js";

/* v8 ignore start -- CLI registration; each command tested via exported handler */
const _lintCommand = Command.make("lint").pipe(
	Command.withSubcommands([fmtCommand]),
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
export const lintCommand = _lintCommand;
/* v8 ignore stop */

// Re-export named handlers for B5/B6 orchestrator consumption.
export { runLintCheck } from "./check.js";
export { runLintInit } from "./init.js";

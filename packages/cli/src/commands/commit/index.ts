import { Command } from "@effect/cli";

import { checkCommand } from "./check.js";
import { hookCommand } from "./hook.js";
import { initCommand } from "./init.js";

/* v8 ignore start -- CLI registration; each command tested via exported handler */
const _commitCommand = Command.make("commit").pipe(
	Command.withSubcommands([initCommand, checkCommand, hookCommand]),
	Command.withDescription("Commit standards: config, checks, and Claude hook handlers"),
);

/**
 * The `savvy commit` command group for use in Task B7 root assembly.
 *
 * @remarks
 * Typed as `unknown` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types. Task B7 should import and use this directly
 * as `Command.withSubcommands([commitCommand])` — the cast is for declaration emit only.
 */
// biome-ignore lint/suspicious/noExplicitAny: Effect Command type infers unexportable internal types from effect
export const commitCommand: Command.Command<"commit", any, any, any> = _commitCommand as Command.Command<
	"commit",
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any
>;
/* v8 ignore stop */

// Re-export named handlers for B5/B6 orchestrator consumption.
export { runCommitCheck } from "./check.js";
export { runCommitInit } from "./init.js";

import { Command } from "@effect/cli";

import { addCommand } from "./commands/add.js";
import { noteCommand } from "./commands/note.js";
import { pinCommand } from "./commands/pin.js";
import { statusCommand } from "./commands/status.js";
import { syncCommand } from "./commands/sync.js";

/* v8 ignore start -- CLI registration; each command tested via exported handler */
const _reposCommand = Command.make("repos").pipe(
	Command.withSubcommands([statusCommand, syncCommand, pinCommand, addCommand, noteCommand]),
	Command.withDescription("Vendored reference repos under .repos/"),
);

/**
 * The `savvy repos` command group.
 *
 * @remarks
 * Typed as `unknown` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types (TS4023), matching the `changesetCommand`
 * export pattern.
 */
// biome-ignore lint/suspicious/noExplicitAny: Effect Command type infers unexportable internal types from effect
export const reposCommand: Command.Command<"repos", any, any, any> = _reposCommand as Command.Command<
	"repos",
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any
>;
/* v8 ignore stop */

export { runReposAdd } from "./commands/add.js";
export { runReposNote } from "./commands/note.js";
export { runReposPin } from "./commands/pin.js";
export { runReposStatus } from "./commands/status.js";
export { runReposSync } from "./commands/sync.js";

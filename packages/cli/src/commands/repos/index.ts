import type { Repos } from "@savvy-web/silk-effects";
import { Command } from "effect/unstable/cli";

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
 * Annotated with the exact five-parameter `Command.Command` instantiation
 * (verified against the inferred type): the bare inferred type additionally
 * prints the structural `subcommands` tree, whose inline command types
 * reference effect's non-exported `Inspectable` module (TS4023). The
 * annotation preserves the exact Error/Requirements channels, so the root
 * layer graph stays compiler-validated.
 */
export const reposCommand: Command.Command<
	"repos",
	Record<string, never>,
	Record<string, never>,
	Repos.GitSubmoduleError,
	never
> = _reposCommand;
/* v8 ignore stop */

export { runReposAdd } from "./commands/add.js";
export { runReposNote } from "./commands/note.js";
export { runReposPin } from "./commands/pin.js";
export { runReposStatus } from "./commands/status.js";
export { runReposSync } from "./commands/sync.js";

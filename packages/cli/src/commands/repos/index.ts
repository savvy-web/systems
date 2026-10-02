import type { Cancelled, CliExit } from "@effected/cli";
import type { Repos } from "@savvy-web/silk-effects";
import type { CliError } from "effect/cli";
import { Command } from "effect/cli";
import type { CommandError } from "../../internal/command-error.js";
import type { ReportEnv } from "../../internal/report.js";

import { addCommand } from "./commands/add.js";
import { deregisterCommand } from "./commands/deregister.js";
import { noteCommand } from "./commands/note.js";
import { pinCommand } from "./commands/pin.js";
import { removeCommand } from "./commands/remove.js";
import { renameCommand } from "./commands/rename.js";
import { restoreCommand } from "./commands/restore.js";
import { statusCommand } from "./commands/status.js";
import { syncCommand } from "./commands/sync.js";

/* v8 ignore start -- CLI registration; each command tested via exported handler */
const _reposCommand = Command.make("repos").pipe(
	Command.withSubcommands([
		statusCommand,
		syncCommand,
		pinCommand,
		addCommand,
		noteCommand,
		removeCommand,
		renameCommand,
		restoreCommand,
		deregisterCommand,
	]),
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
 *
 * The requirements channel names `Repos.ReposManager | Repos.ReposDrift`
 * rather than `never`: `Command.withSubcommands` propagates each
 * subcommand's requirements up into the group's `R`, which the root assembly
 * discharges via `AppLive`. `Repos.ReposDrift` joins the union because
 * `status --drift` runs `Repos.ReposDrift.check` after the status check.
 *
 * The error channel is what a handler fails with, never a raw `Repos` error:
 * every handler maps each error its `ReposManager` method (or the picker's
 * `status` read) can produce to a self-rendering `CommandError` (exit 1),
 * except the friendly missing-manifest case and `status --json`'s JSON error
 * document. A repo name or other positional left off is a
 * `CliError.ShowHelp` (exit 64) when no one can be asked, and backing out of
 * a picker or a confirm is the kit's `Cancelled` (exit 130).
 */
export const reposCommand: Command.Command<
	"repos",
	Record<string, never>,
	Record<string, never>,
	CommandError | CliError.ShowHelp | Cancelled,
	Repos.ReposManager | Repos.ReposDrift | CliExit | ReportEnv
> = _reposCommand;
/* v8 ignore stop */

export { runReposAdd } from "./commands/add.js";
export { runReposDeregister } from "./commands/deregister.js";
export { runReposNote } from "./commands/note.js";
export { runReposPin } from "./commands/pin.js";
export { runReposRemove } from "./commands/remove.js";
export { runReposRename } from "./commands/rename.js";
export { runReposRestore } from "./commands/restore.js";
export { runReposStatus } from "./commands/status.js";
export { runReposSync } from "./commands/sync.js";

import type { Repos } from "@savvy-web/silk-effects";
import { Command } from "effect/unstable/cli";

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
 * The error channel is `Repos.GitSubmoduleError` alone: `add`/`pin`/`note`/
 * `remove`/`rename`/`restore`/`sync`/`deregister` each `catchTag` every error
 * their underlying `ReposManager` method can produce — `ReposConfigError`,
 * `GitSubmoduleError`, `RepoNotFoundError`, `NoteNotFoundError`, and (for the
 * six ops that unlock/re-lock the vendored tree around a git mutation)
 * `ReposLockdownError` — down to a logged message and a non-zero exit code,
 * so none of those propagate past the handler. `status` only `catchTag`s
 * `ReposConfigError`; `GitSubmoduleError` from either `ReposManager.status`
 * or (under `--drift`) `Repos.ReposDrift.check` is the sole channel that
 * escapes uncaught, so it is the only member left in this union.
 */
export const reposCommand: Command.Command<
	"repos",
	Record<string, never>,
	Record<string, never>,
	Repos.GitSubmoduleError,
	Repos.ReposManager | Repos.ReposDrift
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

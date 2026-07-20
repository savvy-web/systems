import type { Changesets } from "@savvy-web/silk-effects";
import type { Cause, FileSystem, Path } from "effect";
import { Command } from "effect/unstable/cli";
import type { ChildProcessSpawner } from "effect/unstable/process";

import { checkCommand } from "./commands/check.js";
import { configValidateCommand } from "./commands/config-validate.js";
import { depsDetectCommand } from "./commands/deps-detect.js";
import { depsRegenCommand } from "./commands/deps-regen.js";
import { lintCommand } from "./commands/lint.js";
import { transformCommand } from "./commands/transform.js";
import { validateFileCommand } from "./commands/validate-file.js";
import { versionCommand } from "./commands/version.js";

/* v8 ignore start -- CLI registration; each command tested via exported handler */
const configGroup = Command.make("config").pipe(
	Command.withSubcommands([configValidateCommand]),
	Command.withDescription("Inspect or validate .changeset/config.json"),
);

const depsGroup = Command.make("deps").pipe(
	Command.withSubcommands([depsDetectCommand, depsRegenCommand]),
	Command.withDescription("Generate or regenerate dependency changesets"),
);

const _changesetCommand = Command.make("changeset").pipe(
	Command.withSubcommands([
		lintCommand,
		checkCommand,
		transformCommand,
		validateFileCommand,
		versionCommand,
		configGroup,
		depsGroup,
	]),
	Command.withDescription("Section-aware changeset tooling"),
);

/**
 * The `savvy changeset` command group for use in Task B7 root assembly.
 *
 * @remarks
 * Annotated with the exact five-parameter `Command.Command` instantiation
 * (verified against the inferred type): the bare inferred type additionally
 * prints the structural `subcommands` tree, whose inline command types
 * reference effect's non-exported `Inspectable` module (TS4023). The
 * annotation preserves the exact Error/Requirements channels, so the root
 * layer graph stays compiler-validated.
 *
 * The requirements channel names the subcommands' services rather than `never`:
 * `Command.withSubcommands` propagates each subcommand's requirements up into
 * the group's `R`, which the root assembly discharges via `AppLive`.
 */
export const changesetCommand: Command.Command<
	"changeset",
	Record<string, never>,
	Record<string, never>,
	| Changesets.ConfigurationError
	| Error
	| Changesets.ReleasePlanError
	| Cause.UnknownError
	| Changesets.DepsRegenPlanError,
	| ChildProcessSpawner.ChildProcessSpawner
	| Changesets.ConfigInspector
	| FileSystem.FileSystem
	| Path.Path
	| Changesets.ReleasePlanner
> = _changesetCommand;
/* v8 ignore stop */

// Re-export named handlers for B5/B6 orchestrator consumption.
export { runChangesetCheck } from "./commands/check.js";
export { runChangesetInit } from "./commands/init.js";

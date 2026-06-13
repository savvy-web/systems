import { Command } from "@effect/cli";

import { analyzeBranchCommand } from "./commands/analyze-branch.js";
import { checkCommand } from "./commands/check.js";
import { classifyCommand } from "./commands/classify.js";
import { configShowCommand } from "./commands/config-show.js";
import { configValidateCommand } from "./commands/config-validate.js";
import { depsDetectCommand } from "./commands/deps-detect.js";
import { depsRegenCommand } from "./commands/deps-regen.js";
import { lintCommand } from "./commands/lint.js";
import { releaseSurfaceCommand } from "./commands/release-surface.js";
import { transformCommand } from "./commands/transform.js";
import { validateFileCommand } from "./commands/validate-file.js";
import { versionCommand } from "./commands/version.js";

/* v8 ignore start -- CLI registration; each command tested via exported handler */
const configGroup = Command.make("config").pipe(
	Command.withSubcommands([configShowCommand, configValidateCommand]),
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
		classifyCommand,
		analyzeBranchCommand,
		releaseSurfaceCommand,
		configGroup,
		depsGroup,
	]),
	Command.withDescription("Section-aware changeset tooling"),
);

/**
 * The `savvy changeset` command group for use in Task B7 root assembly.
 *
 * @remarks
 * Typed as `unknown` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types. Task B7 should import and use this via
 * `Command.withSubcommands([changesetCommand as never])` or re-infer the type.
 */
// biome-ignore lint/suspicious/noExplicitAny: Effect Command type infers unexportable internal types from effect
export const changesetCommand: Command.Command<"changeset", any, any, any> = _changesetCommand as Command.Command<
	"changeset",
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any
>;
/* v8 ignore stop */

// Re-export named handlers for B5/B6 orchestrator consumption.
export { runChangesetCheck } from "./commands/check.js";
export { runChangesetInit } from "./commands/init.js";

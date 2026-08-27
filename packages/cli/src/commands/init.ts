/**
 * Unified `savvy init` orchestrator.
 *
 * @remarks
 * Sequences the three tool-specific init handlers — changeset → commit → lint —
 * in a single pass. Short-circuits on the first failure. The three step Effects
 * are injected so the orchestration logic is unit-testable in isolation.
 *
 * Runtime layer provision (ManagedSection, FileSystem, WorkspaceRoot,
 * BiomeSchemaSync, etc.) is deferred to Task B7 (root `runCli`). The Effect
 * returned by `initCommand`'s handler therefore carries the full union of the
 * three handlers' requirements in its R channel.
 *
 * @internal
 */

import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { runChangesetInit } from "./changeset/index.js";
import { runCommitInit } from "./commit/init.js";
import { runLintInit } from "./lint/init.js";

// ---------------------------------------------------------------------------
// Default option values for sub-tool config paths
// ---------------------------------------------------------------------------

const DEFAULT_COMMIT_CONFIG = "lib/configs/commitlint.config.ts";
const DEFAULT_LINT_CONFIG = "lib/configs/lint-staged.config.ts";

// ---------------------------------------------------------------------------
// CLI option definitions
// ---------------------------------------------------------------------------

/* v8 ignore start -- CLI option definitions; orchestration logic tested via runInit */
const forceOption = Flag.boolean("force").pipe(
	Flag.withAlias("f"),
	Flag.withDescription("Overwrite existing config files and hooks across all tools"),
	Flag.withDefault(false),
);

const commitConfigOption = Flag.string("commit-config").pipe(
	Flag.withDescription("Relative path for the commitlint config file"),
	Flag.withDefault(DEFAULT_COMMIT_CONFIG),
);

const lintConfigOption = Flag.string("lint-config").pipe(
	Flag.withDescription("Relative path for the lint-staged config file"),
	Flag.withDefault(DEFAULT_LINT_CONFIG),
);

const lintPresetOption = Flag.choice("lint-preset", ["minimal", "standard", "silk"]).pipe(
	Flag.withDescription("lint-staged preset: minimal, standard, or silk"),
	Flag.withDefault("silk" as const),
);
/* v8 ignore stop */

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the three init step Effects in order: changeset → commit → lint.
 *
 * Monadic sequencing via `Effect.gen` short-circuits on the first failure —
 * if changeset fails, neither commit nor lint will run.
 *
 * @param steps - The three step Effects to sequence. Injected for testability.
 * @returns An Effect that resolves to `void` on success, or fails with the
 *   error of the first failing step.
 */
export function runInit<EChangeset, RChangeset, ECommit, RCommit, ELint, RLint>(steps: {
	changeset: Effect.Effect<unknown, EChangeset, RChangeset>;
	commit: Effect.Effect<unknown, ECommit, RCommit>;
	lint: Effect.Effect<unknown, ELint, RLint>;
}): Effect.Effect<void, EChangeset | ECommit | ELint, RChangeset | RCommit | RLint> {
	return Effect.gen(function* () {
		yield* steps.changeset;
		yield* steps.commit;
		yield* steps.lint;
	});
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

/* v8 ignore start -- CLI registration; orchestration logic tested via runInit */
const _initCommand = Command.make(
	"init",
	{ force: forceOption, commitConfig: commitConfigOption, lintConfig: lintConfigOption, lintPreset: lintPresetOption },
	(opts) =>
		runInit({
			changeset: runChangesetInit({
				force: opts.force,
				quiet: false,
				skipMarkdownlint: false,
				check: false,
			}),
			commit: runCommitInit({
				force: opts.force,
				config: opts.commitConfig,
			}),
			lint: runLintInit({
				force: opts.force,
				config: opts.lintConfig,
				preset: opts.lintPreset,
			}),
		}),
).pipe(Command.withDescription("Bootstrap a repository for all Silk Suite tools in one pass"));
/* v8 ignore stop */

/**
 * The `savvy init` command for use in the Task B7 root assembly.
 *
 * @remarks
 * Typed with `any` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types. Task B7 should use this via
 * `Command.withSubcommands([initCommand as never])` or re-infer the type.
 */
export const initCommand = _initCommand;

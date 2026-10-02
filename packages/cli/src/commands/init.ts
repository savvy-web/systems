/**
 * Unified `savvy init` orchestrator.
 *
 * @remarks
 * Sequences the three tool-specific init handlers — changeset → commit → lint —
 * in a single pass. Short-circuits on the first failure. The three step Effects
 * are injected so the orchestration logic is unit-testable in isolation.
 *
 * Runtime layer provision (ManagedSection, FileSystem, WorkspaceRoot,
 * BiomeSchemaSync, etc.) is deferred to Task B7 (root `main`). The Effect
 * returned by `initCommand`'s handler therefore carries the full union of the
 * three handlers' requirements in its R channel.
 *
 * @internal
 */

import type { Cancelled, CliTheme } from "@effected/cli";
import { CliUi, Select } from "@effected/cli/ui";
import { Lint } from "@savvy-web/silk-effects";
import { Effect, FileSystem } from "effect";
import { Command, Flag } from "effect/cli";
import { CommandError } from "../internal/command-error.js";
import { confirmDestructive, yesFlag } from "../internal/confirm.js";
import type { ReportEnv } from "../internal/report.js";
import { Report } from "../internal/report.js";
import { runChangesetInit } from "./changeset/index.js";
import { HUSKY_HOOK_PATH as COMMIT_MSG_HOOK_PATH } from "./commit/constants.js";
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
const forceOption = Flag.Boolean("force").pipe(
	Flag.withAlias("f"),
	Flag.withDescription("Overwrite existing config files and hooks across all tools"),
	Flag.withDefault(false),
);

const commitConfigOption = Flag.String("commit-config").pipe(
	Flag.withDescription("Relative path for the commitlint config file"),
	Flag.withDefault(DEFAULT_COMMIT_CONFIG),
);

const lintConfigOption = Flag.String("lint-config").pipe(
	Flag.withDescription("Relative path for the lint-staged config file"),
	Flag.withDefault(DEFAULT_LINT_CONFIG),
);

/* v8 ignore stop */

/** The lint-staged presets `--lint-preset` accepts. */
export type LintPreset = "minimal" | "standard" | "silk";

/** The preset a run that cannot ask uses: an agent, CI, a pipe. */
const DEFAULT_LINT_PRESET: LintPreset = "silk";

/**
 * `--lint-preset`: given, it is used as is; omitted, a person at a terminal
 * picks one from a `Select` (starting on `silk`), and every other run uses
 * `silk` without loading Ink or React.
 *
 * @internal
 */
export const lintPresetOption: Flag.Flag<LintPreset> = Flag.Literals("lint-preset", [
	"minimal",
	"standard",
	"silk",
] as const).pipe(
	Flag.withDescription(
		"lint-staged preset: minimal, standard, or silk (asked when omitted at a terminal; default silk)",
	),
	Flag.withFallbackPrompt(
		CliUi.fallback(
			Select.screen<LintPreset>({
				message: "Which lint-staged preset?",
				choices: [
					{ label: "silk", value: "silk", detail: "Everything in standard, plus the managed markdownlint config" },
					{ label: "standard", value: "standard", detail: "Biome, shell-script hygiene hooks and markdown" },
					{ label: "minimal", value: "minimal", detail: "Biome only" },
				],
			}),
			{ flag: "lint-preset", otherwise: DEFAULT_LINT_PRESET },
		),
	),
);

// ---------------------------------------------------------------------------
// Overwrite confirmation
// ---------------------------------------------------------------------------

/**
 * The files `savvy init --force` replaces wholesale, for the given config
 * paths and preset.
 *
 * @remarks
 * Only the files `--force` rewrites from scratch; the managed sections it
 * syncs into the other hooks are re-synced with or without `--force`.
 *
 * @internal
 */
export function forceTargets(opts: {
	readonly commitConfig: string;
	readonly lintConfig: string;
	readonly lintPreset: LintPreset;
}): ReadonlyArray<string> {
	return [
		".changeset/config.json",
		".changeset/.markdownlint.json",
		COMMIT_MSG_HOOK_PATH,
		opts.commitConfig,
		Lint.HUSKY_HOOK_PATH,
		...(opts.lintPreset === "silk" ? [Lint.MARKDOWNLINT_CONFIG_PATH] : []),
		opts.lintConfig,
	];
}

/**
 * Whether `savvy init` may go ahead: asks before `--force` overwrites files
 * that already exist.
 *
 * @remarks
 * Asks only when `force` is set and at least one of `targets` exists; `--yes`
 * and a run that cannot prompt proceed without asking, as `init --force`
 * always has. A "no" prints a line saying nothing was changed and answers
 * `false`.
 *
 * @internal
 */
export function confirmForce(opts: {
	readonly force: boolean;
	readonly yes: boolean;
	readonly targets: ReadonlyArray<string>;
}): Effect.Effect<boolean, Cancelled, FileSystem.FileSystem | CliTheme | ReportEnv> {
	return Effect.gen(function* () {
		if (!opts.force) return true;
		const fs = yield* FileSystem.FileSystem;
		const existing = yield* Effect.filter(opts.targets, (path) =>
			fs.exists(path).pipe(Effect.orElseSucceed(() => false)),
		);
		if (existing.length === 0) return true;
		const confirmed = yield* confirmDestructive({
			message: `Overwrite ${existing.length} existing file(s) with --force? (${existing.join(", ")})`,
			yes: opts.yes,
		});
		if (!confirmed) {
			yield* Report.print([Report.skip("Nothing changed: existing files kept")]);
		}
		return confirmed;
	});
}

/**
 * The failure a step of `savvy init` stopped with, as a `CommandError` that
 * draws itself; a `CommandError` a step already raised passes through.
 *
 * @internal
 */
export function initFailure(error: unknown): CommandError {
	return error instanceof CommandError
		? error
		: CommandError.from(error, {
				message: "savvy init stopped before finishing",
				hint: "Fix the problem above and re-run savvy init; the steps that already ran are safe to repeat.",
			});
}

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
	{
		force: forceOption,
		yes: yesFlag,
		commitConfig: commitConfigOption,
		lintConfig: lintConfigOption,
		lintPreset: lintPresetOption,
	},
	(opts) =>
		Effect.gen(function* () {
			if (!(yield* confirmForce({ force: opts.force, yes: opts.yes, targets: forceTargets(opts) }))) return;
			yield* runInit({
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
			}).pipe(Effect.mapError(initFailure));
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

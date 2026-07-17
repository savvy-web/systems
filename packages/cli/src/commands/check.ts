/**
 * Unified `savvy check` orchestrator.
 *
 * @remarks
 * Runs all three tool-specific check handlers — changeset, commit, lint —
 * sequentially so each tool's console output is cleanly grouped rather than
 * interleaved. Unlike the `init` orchestrator, check MUST NOT short-circuit:
 * the user wants to see every failing check in a single pass. Uses
 * `Effect.all` with `{ concurrency: 1, mode: "validate" }` to run all three
 * regardless of individual failures and then surface the full set of errors.
 *
 * Runtime layer provision (ManagedSection, FileSystem, WorkspaceRoot,
 * ToolDiscovery, etc.) is deferred to Task B7 (root `runCli`). The Effect
 * returned by `checkCommand`'s handler therefore carries the full union of the
 * three handlers' requirements in its R channel.
 *
 * @internal
 */

import { Effect, Result } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { runChangesetCheck } from "./changeset/index.js";
import { runCommitCheck } from "./commit/check.js";
import { runLintCheck } from "./lint/check.js";

// ---------------------------------------------------------------------------
// Default option values
// ---------------------------------------------------------------------------

const DEFAULT_CHANGESET_DIR = ".changeset";

// ---------------------------------------------------------------------------
// CLI option definitions
// ---------------------------------------------------------------------------

/* v8 ignore start -- CLI option definitions; orchestration logic tested via runCheck */
const changesetDirOption = Flag.string("changeset-dir").pipe(
	Flag.withDescription("Path to the changeset directory"),
	Flag.withDefault(DEFAULT_CHANGESET_DIR),
);

const quietOption = Flag.boolean("quiet").pipe(
	Flag.withAlias("q"),
	Flag.withDescription("Only output warnings from lint check"),
	Flag.withDefault(false),
);
/* v8 ignore stop */

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run all three check step Effects without short-circuiting.
 *
 * All three checks always run, sequentially (concurrency 1) so per-tool
 * output stays grouped. If any fail, the combined Effect fails with all
 * accumulated errors. Uses `Effect.all` with `{ concurrency: 1, mode: "validate" }`
 * to collect every failure rather than stopping at the first.
 *
 * @param steps - The three step Effects to run. Injected for testability.
 * @returns An Effect that resolves to `void` on success, or fails with the
 *   union of all failing steps' errors.
 */
export function runCheck<EChangeset, RChangeset, ECommit, RCommit, ELint, RLint>(steps: {
	changeset: Effect.Effect<unknown, EChangeset, RChangeset>;
	commit: Effect.Effect<unknown, ECommit, RCommit>;
	lint: Effect.Effect<unknown, ELint, RLint>;
}): Effect.Effect<void, EChangeset | ECommit | ELint, RChangeset | RCommit | RLint> {
	// v4's Effect.all dropped the v3 "validate" mode; "result" collects a
	// Result per step so every step still RUNS (nothing short-circuits), then
	// the first failure is re-raised to preserve the fail-if-any contract.
	return Effect.gen(function* () {
		const results: ReadonlyArray<Result.Result<unknown, EChangeset | ECommit | ELint>> = yield* Effect.all(
			[Effect.result(steps.changeset), Effect.result(steps.commit), Effect.result(steps.lint)],
			{ concurrency: 1 },
		);
		for (const result of results) {
			if (Result.isFailure(result)) {
				return yield* Effect.fail(result.failure);
			}
		}
	});
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

/* v8 ignore start -- CLI registration; orchestration logic tested via runCheck */
const _checkCommand = Command.make("check", { changesetDir: changesetDirOption, quiet: quietOption }, (opts) =>
	runCheck({
		changeset: runChangesetCheck(opts.changesetDir),
		commit: runCommitCheck(),
		lint: runLintCheck({ quiet: opts.quiet }),
	}),
).pipe(Command.withDescription("Validate all Silk Suite tool configurations in one pass"));
/* v8 ignore stop */

/**
 * The `savvy check` command for use in the Task B7 root assembly.
 *
 * @remarks
 * Typed with `any` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types. Task B7 should use this via
 * `Command.withSubcommands([checkCommand as never])` or re-infer the type.
 */
export const checkCommand = _checkCommand;

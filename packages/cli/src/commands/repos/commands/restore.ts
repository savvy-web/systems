/**
 * `repos restore` command -- hard-reset one or more vendored `.repos/`
 * submodules back to their pinned gitlink commit.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.restore}: explicit only --
 * never invoked by `sync` or any other implicit path. DESTRUCTIVE to
 * uncommitted worktree edits and untracked files in the repos it touches:
 * each targeted repo is hard-reset to its staged gitlink commit (falling
 * back to the committed one) and its sparse-checkout paths re-applied.
 * With one or more `name` arguments, exactly those repos are restored, even
 * if already clean -- an explicit ask is always honored. With no names, every
 * DIRTY repo (per `status`) is restored and the clean ones are reported as
 * skipped.
 *
 * A `ReposConfigError` with kind `"missing"` -- nothing vendored yet -- is
 * the common, friendly case and always exits 0. A `ReposConfigError` with
 * kind `"invalid"` means the manifest exists but is corrupt or unreadable.
 * `RepoNotFoundError` means an explicitly named repo isn't in the manifest --
 * a real failure, since restoring a name that was never vendored is almost
 * always a typo the caller should see. `GitSubmoduleError` means the
 * underlying git command failed (including the case where a repo has
 * neither a staged nor a committed gitlink commit to restore to), and
 * `ReposLockdownError` means the OS-permission lockdown pass on a vendored
 * tree failed -- all four are real failures, logged and reported via a
 * non-zero exit code.
 *
 * @example
 * ```bash
 * savvy repos restore my-repo
 * savvy repos restore my-repo other-repo
 * savvy repos restore
 * ```
 *
 * @internal
 */

import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

/* v8 ignore start -- CLI option/arg definitions */
const namesArg = Argument.string("name").pipe(Argument.variadic());
const cwdOption = Flag.directory("cwd").pipe(
	Flag.withDescription("Repo root to restore within"),
	Flag.withDefault("."),
);
/* v8 ignore stop */

/**
 * Restore handler; exported for tests.
 *
 * @internal
 */
export const runReposRestore = (cwd: string, names: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.restore(cwd, names.length > 0 ? names : undefined);
		for (const entry of result.restored) {
			yield* Effect.log(`${entry.name}: restored to ${entry.commit}`);
		}
		for (const name of result.skippedClean) {
			yield* Effect.log(`${name}: clean — skipped`);
		}
		// Reporting a reset that ran while the tree stayed dirty as a plain
		// success is what let a nested-submodule divergence look repaired for
		// months. Say it, and set a failing exit code so a script notices.
		for (const name of result.stillDirty) {
			yield* Effect.log(
				`${name}: WARNING — reset ran but the worktree is STILL dirty; run \`savvy repos status --drift\``,
			);
		}
		if (result.stillDirty.length > 0) {
			process.exitCode = 1;
		}
		if (result.restored.length === 0 && result.skippedClean.length === 0) {
			yield* Effect.log("nothing to restore");
		}
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) => {
			if (error.kind === "missing") {
				return Effect.log("no .repos/config.json — nothing vendored");
			}
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
		Effect.catchTag("RepoNotFoundError", (error) => {
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
		Effect.catchTag("GitSubmoduleError", (error) => {
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
		Effect.catchTag("ReposLockdownError", (error) => {
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposRestore */
export const restoreCommand = Command.make("restore", { names: namesArg, cwd: cwdOption }, ({ names, cwd }) =>
	runReposRestore(cwd, names),
).pipe(
	Command.withDescription(
		"Hard-reset vendored repos to their pinned commit; DESTRUCTIVE to uncommitted worktree edits. Given no names, restores every dirty repo",
	),
);
/* v8 ignore stop */

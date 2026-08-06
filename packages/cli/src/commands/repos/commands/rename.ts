/**
 * `repos rename` command -- rename a vendored `.repos/` submodule's manifest
 * key and worktree.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.rename}: moves the worktree
 * (`git mv`), re-points the module gitdir's `core.worktree` values,
 * canonicalizes the `.gitmodules` section name, and renames the manifest
 * key -- it does not commit, so the caller reviews and commits the staged
 * rename with the ready-made message the result carries.
 *
 * A `ReposConfigError` with kind `"missing"` -- nothing vendored yet -- is
 * the common, friendly case and always exits 0. A `ReposConfigError` with
 * kind `"invalid"` means either the manifest exists but is corrupt/unreadable
 * OR the requested new name is invalid/already vendored. `RepoNotFoundError`
 * means the old name isn't in the manifest -- this is a REAL failure, since
 * renaming a name that was never vendored is almost always a typo the caller
 * should see. `GitSubmoduleError` means the underlying git command failed,
 * and `ReposLockdownError` means the OS-permission lockdown pass on a
 * vendored tree failed -- all four (invalid config, not-found, git failure,
 * lockdown failure) are real failures, logged and reported via a non-zero
 * exit code.
 *
 * @example
 * ```bash
 * savvy repos rename old-name new-name
 * ```
 *
 * @internal
 */

import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

/* v8 ignore start -- CLI option/arg definitions */
const oldNameArg = Argument.string("old-name");
const newNameArg = Argument.string("new-name");
const cwdOption = Flag.directory("cwd").pipe(Flag.withDescription("Repo root to rename within"), Flag.withDefault("."));
/* v8 ignore stop */

/**
 * Rename handler; exported for tests.
 *
 * @internal
 */
export const runReposRename = (cwd: string, oldName: string, newName: string) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.rename(cwd, oldName, newName);
		yield* Effect.log(`${result.oldName}: renamed to ${result.newName} (${result.path})`);
		yield* Effect.log(result.commitMessage);
		yield* Effect.log("staged — review and commit");
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

/* v8 ignore start -- CLI registration; handler tested via runReposRename */
export const renameCommand = Command.make(
	"rename",
	{ oldName: oldNameArg, newName: newNameArg, cwd: cwdOption },
	({ oldName, newName, cwd }) => runReposRename(cwd, oldName, newName),
).pipe(
	Command.withDescription("Rename a vendored repo's manifest key and worktree; stages the change without committing"),
);
/* v8 ignore stop */

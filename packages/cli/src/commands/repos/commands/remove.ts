/**
 * `repos remove` command -- unvendor a `.repos/` submodule.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.remove}: deinitializes and
 * removes the submodule's gitlink, worktree, and module gitdir, drops its
 * `.gitmodules` section, and removes the manifest entry -- it does not
 * commit, so the caller reviews and commits the staged removal with the
 * ready-made message the result carries. Any notes the entry carried are
 * surfaced in the result so a durable one can be promoted elsewhere first.
 *
 * A `ReposConfigError` with kind `"missing"` -- nothing vendored yet -- is
 * the common, friendly case and always exits 0. A `ReposConfigError` with
 * kind `"invalid"` means the manifest exists but is corrupt or unreadable.
 * `RepoNotFoundError` means the named repo isn't in the manifest -- this is
 * a REAL failure (unlike the "missing manifest" case above), since removing
 * a name that was never vendored is almost always a typo the caller should
 * see. `GitSubmoduleError` means the underlying git command failed, and
 * `ReposLockdownError` means the OS-permission lockdown pass on a vendored
 * tree failed -- all four (invalid config, not-found, git failure, lockdown
 * failure) are real failures, logged and reported via a non-zero exit code.
 *
 * @example
 * ```bash
 * savvy repos remove my-repo
 * ```
 *
 * @internal
 */

import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

/* v8 ignore start -- CLI option/arg definitions */
const nameArg = Argument.string("name");
const cwdOption = Flag.directory("cwd").pipe(Flag.withDescription("Repo root to remove within"), Flag.withDefault("."));
/* v8 ignore stop */

/**
 * Remove handler; exported for tests.
 *
 * @internal
 */
export const runReposRemove = (cwd: string, name: string) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.remove(cwd, name);
		yield* Effect.log(`${result.name}: removed (${result.path})`);
		yield* Effect.log(result.commitMessage);
		yield* Effect.log("staged — review and commit");
		for (const note of result.removedNotes) {
			yield* Effect.log(`warning: note ${note.id} (${note.ref}) was removed with the entry — promote first if durable`);
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

/* v8 ignore start -- CLI registration; handler tested via runReposRemove */
export const removeCommand = Command.make("remove", { name: nameArg, cwd: cwdOption }, ({ name, cwd }) =>
	runReposRemove(cwd, name),
).pipe(Command.withDescription("Unvendor a repo under .repos/; stages the removal without committing"));
/* v8 ignore stop */

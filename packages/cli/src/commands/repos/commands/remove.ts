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

import { CliExit } from "@effected/cli";
import { Repos } from "@savvy-web/silk-effects";
import type { Stdio } from "effect";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { Output } from "../../../internal/output.js";

/* v8 ignore start -- CLI option/arg definitions */
const nameArg = Argument.String("name");
const cwdOption = Flag.Directory("cwd").pipe(Flag.withDescription("Repo root to remove within"), Flag.withDefault("."));
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
		yield* Output.ok(`${result.name}: removed (${result.path})`);
		yield* Output.detail(result.commitMessage);
		yield* Output.detail("staged — review and commit");
		for (const note of result.removedNotes) {
			yield* Output.warn(`note ${note.id} (${note.ref}) was removed with the entry — promote first if durable`);
		}
		// `add` has an `orientation` parameter but does not resurrect anything on
		// its own, so anyone re-vendoring after this loses the block unless they
		// are handed it here, while it still exists.
		if (result.removedEntry.orientation) {
			yield* Output.warn(
				`the orientation block for ${result.name} was removed with the entry and add will NOT restore it — re-vendoring? capture it now:`,
			);
			yield* Output.line(JSON.stringify(result.removedEntry.orientation, null, 2));
		}
	}).pipe(
		Effect.catchTag("ReposConfigError", (error): Effect.Effect<void, never, CliExit | Stdio.Stdio> => {
			if (error.kind === "missing") {
				return Output.skip("no .repos/config.json — nothing vendored");
			}
			return CliExit.set(1).pipe(Effect.andThen(Effect.logError(error.message)));
		}),
		Effect.catchTag("RepoNotFoundError", (error) => {
			return CliExit.set(1).pipe(Effect.andThen(Effect.logError(error.message)));
		}),
		Effect.catchTag("GitSubmoduleError", (error) => {
			return CliExit.set(1).pipe(Effect.andThen(Effect.logError(error.message)));
		}),
		Effect.catchTag("ReposLockdownError", (error) => {
			return CliExit.set(1).pipe(Effect.andThen(Effect.logError(error.message)));
		}),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposRemove */
export const removeCommand = Command.make("remove", { name: nameArg, cwd: cwdOption }, ({ name, cwd }) =>
	runReposRemove(cwd, name),
).pipe(Command.withDescription("Unvendor a repo under .repos/; stages the removal without committing"));
/* v8 ignore stop */

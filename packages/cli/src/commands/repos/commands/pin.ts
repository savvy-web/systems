/**
 * `repos pin` command -- re-pin a vendored `.repos/` submodule to a new ref.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.pin}: shallow-fetches the new
 * ref, detaches HEAD onto it, rewrites the manifest entry, and stages the
 * gitlink plus the manifest -- it does not commit, so the caller reviews and
 * commits the staged change with the ready-made message the result carries.
 * A `ReposConfigError` with kind `"missing"` -- nothing vendored yet -- is
 * the common, friendly case and always exits 0. A `ReposConfigError` with
 * kind `"invalid"` means the manifest exists but is corrupt or unreadable,
 * `GitSubmoduleError` means the underlying git command failed,
 * `RepoNotFoundError` means the named repo isn't in the manifest, and
 * `ReposLockdownError` means the OS-permission lockdown pass on a vendored
 * tree failed -- all four are real failures, logged and reported via a
 * non-zero exit code.
 *
 * @example
 * ```bash
 * savvy repos pin my-repo v2.0.0
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
const refArg = Argument.String("ref");
const cwdOption = Flag.Directory("cwd").pipe(Flag.withDescription("Repo root to pin within"), Flag.withDefault("."));
/* v8 ignore stop */

/**
 * Pin handler; exported for tests.
 *
 * @internal
 */
export const runReposPin = (cwd: string, name: string, ref: string) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.pin(cwd, name, ref);
		yield* Output.ok(`${result.name}: ${result.oldCommit ?? "unknown"} -> ${result.newCommit}`);
		yield* Output.detail(result.commitMessage);
		yield* Output.detail("staged — review and commit");
		for (const staleId of result.staleNoteIds) {
			yield* Output.warn(`note ${staleId} is now stale against ${ref}`);
		}
	}).pipe(
		Effect.catchTag("ReposConfigError", (error): Effect.Effect<void, never, CliExit | Stdio.Stdio> => {
			if (error.kind === "missing") {
				return Output.skip("no .repos/config.json — nothing vendored");
			}
			return CliExit.set(1).pipe(Effect.andThen(Effect.logError(error.message)));
		}),
		Effect.catchTag("GitSubmoduleError", (error) => {
			return CliExit.set(1).pipe(Effect.andThen(Effect.logError(error.message)));
		}),
		Effect.catchTag("RepoNotFoundError", (error) => {
			return CliExit.set(1).pipe(Effect.andThen(Effect.logError(error.message)));
		}),
		Effect.catchTag("ReposLockdownError", (error) => {
			return CliExit.set(1).pipe(Effect.andThen(Effect.logError(error.message)));
		}),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposPin */
export const pinCommand = Command.make("pin", { name: nameArg, ref: refArg, cwd: cwdOption }, ({ name, ref, cwd }) =>
	runReposPin(cwd, name, ref),
).pipe(Command.withDescription("Re-pin a vendored repo to a new ref; stages the change without committing"));
/* v8 ignore stop */

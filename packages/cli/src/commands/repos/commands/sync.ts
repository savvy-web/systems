/**
 * `repos sync` command -- reconcile vendored `.repos/` submodules with the manifest.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.sync}: initializes missing
 * submodules, re-applies sparse-checkout patterns, and clears stale git
 * locks left behind by an interrupted fetch. Sync is idempotent repair, so
 * a `ReposConfigError` with kind `"missing"` -- the common, friendly case
 * (nothing to sync yet) -- always exits 0. A `ReposConfigError` with kind
 * `"invalid"` means the manifest exists but is corrupt or unreadable,
 * `GitSubmoduleError` means the underlying git command failed, and
 * `ReposLockdownError` means the OS-permission lockdown pass on a vendored
 * tree failed -- all three are real failures, logged and reported via a
 * non-zero exit code.
 *
 * @example
 * ```bash
 * savvy repos sync
 * ```
 *
 * @internal
 */

import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

/* v8 ignore start -- CLI option definitions */
const cwdOption = Flag.directory("cwd").pipe(Flag.withDescription("Repo root to sync"), Flag.withDefault("."));
/* v8 ignore stop */

/**
 * Sync handler; exported for tests.
 *
 * @internal
 */
export const runReposSync = (cwd: string) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const report = yield* manager.sync(cwd);
		for (const name of report.clearedLocks) {
			yield* Effect.log(`${name}: cleared stale lock`);
		}
		for (const name of report.initialized) {
			yield* Effect.log(`${name}: initialized`);
		}
		for (const name of report.sparseApplied) {
			yield* Effect.log(`${name}: sparse-checkout applied`);
		}
		if (report.initialized.length === 0 && report.sparseApplied.length === 0 && report.clearedLocks.length === 0) {
			yield* Effect.log("all vendored repos up to date");
		}
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) => {
			if (error.kind === "missing") {
				return Effect.log("no .repos/config.json — nothing vendored");
			}
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
		Effect.catchTag("GitSubmoduleError", (error) => {
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposSync */
export const syncCommand = Command.make("sync", { cwd: cwdOption }, ({ cwd }) => runReposSync(cwd)).pipe(
	Command.withDescription("Reconcile vendored submodules with the manifest: init missing, apply sparse, clear locks"),
);
/* v8 ignore stop */

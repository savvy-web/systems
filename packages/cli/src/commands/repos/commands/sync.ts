/**
 * `repos sync` command -- reconcile vendored `.repos/` submodules with the manifest.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.sync}: initializes missing
 * submodules, re-applies sparse-checkout patterns, and clears stale git
 * locks left behind by an interrupted fetch. Sync is idempotent repair, so
 * it always exits 0 -- an absent `.repos/config.json` manifest is the
 * common, friendly case (nothing to sync yet), not an error.
 *
 * @example
 * ```bash
 * savvy repos sync
 * ```
 *
 * @internal
 */

import { Command, Options } from "@effect/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";

/* v8 ignore start -- CLI option definitions */
const cwdOption = Options.directory("cwd").pipe(Options.withDescription("Repo root to sync"), Options.withDefault("."));
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
	}).pipe(Effect.catchTag("ReposConfigError", () => Effect.log("no .repos/config.json — nothing vendored")));

/* v8 ignore start -- CLI registration; handler tested via runReposSync */
export const syncCommand = Command.make("sync", { cwd: cwdOption }, ({ cwd }) => runReposSync(cwd)).pipe(
	Command.withDescription("Reconcile vendored submodules with the manifest: init missing, apply sparse, clear locks"),
);
/* v8 ignore stop */

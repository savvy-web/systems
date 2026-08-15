/**
 * `repos deregister` command -- clear a stale submodule registration from the
 * superproject's LOCAL git config.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.deregister}: removes the
 * `submodule.<section>` section a rename or an unvendoring left behind — the
 * phantom entry `savvy repos status --drift` reports as
 * `localRegistrationDivergence` with no matching manifest entry. The section
 * argument is the registration name exactly as the drift report states it
 * (e.g. `.repos/old-name`); the `submodule.` prefix is implied.
 *
 * Unlike the other mutating repos commands, nothing is staged afterwards:
 * the local git config is unversioned, so there is nothing to commit. It also
 * never touches a vendored worktree, so no lockdown bracket is involved and
 * `ReposLockdownError` is not in its error union.
 *
 * Every failure here is a REAL failure (exit 1): a `ReposConfigError` means
 * the section still backs a live manifest entry (use `remove` to unvendor, or
 * `sync` to reconcile), the section is not registered at all (usually a
 * typo), or the manifest itself is unreadable; a `GitSubmoduleError` means
 * the underlying git command failed. There is no friendly missing-manifest
 * exit-0 case: the manager folds a missing manifest to "no live entries" and
 * proceeds, since a stale registration can outlive the manifest itself.
 *
 * @example
 * ```bash
 * savvy repos deregister .repos/old-name
 * ```
 *
 * @internal
 */

import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

/* v8 ignore start -- CLI option/arg definitions */
const sectionArg = Argument.string("section");
const cwdOption = Flag.directory("cwd").pipe(
	Flag.withDescription("Repo root to deregister within"),
	Flag.withDefault("."),
);
/* v8 ignore stop */

/**
 * Deregister handler; exported for tests.
 *
 * @internal
 */
export const runReposDeregister = (cwd: string, section: string) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.deregister(cwd, section);
		yield* Effect.log(`${result.section}: deregistered (${result.removedKeys.length} config keys removed)`);
		for (const key of result.removedKeys) {
			yield* Effect.log(`  removed ${key}`);
		}
		yield* Effect.log("local git config only — nothing to commit");
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) => {
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
		Effect.catchTag("GitSubmoduleError", (error) => {
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposDeregister */
export const deregisterCommand = Command.make(
	"deregister",
	{ section: sectionArg, cwd: cwdOption },
	({ section, cwd }) => runReposDeregister(cwd, section),
).pipe(
	Command.withDescription(
		"Clear a stale submodule registration (a submodule.<section> section matching no manifest entry) from the local git config",
	),
);
/* v8 ignore stop */

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
 * the underlying git command failed. Each fails as a `CommandError` with a
 * hint. There is no friendly missing-manifest exit-0 case: the manager folds
 * a missing manifest to "no live entries" and proceeds, since a stale
 * registration can outlive the manifest itself.
 *
 * Left off at a terminal, the section is picked (`Select`) from the stale
 * registrations `ReposDrift.check` reports — a `localRegistrationDivergence`
 * with no manifest value — never from the vendored repos, which this command
 * refuses. Anywhere else, or with nothing stale to pick, a missing section is
 * the usage error it always was, exit 64.
 *
 * @example
 * ```bash
 * savvy repos deregister .repos/old-name
 * ```
 *
 * @internal
 */

import { CliInteractive } from "@effected/cli";
import { CliUi, Select } from "@effected/cli/ui";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";

/* v8 ignore start -- CLI option/arg definitions */
const sectionArg = Argument.String("section").pipe(Argument.optional);
const cwdOption = Flag.Directory("cwd").pipe(
	Flag.withDescription("Repo root to deregister within"),
	Flag.withDefault("."),
);
/* v8 ignore stop */

/** The section given, or one picked from the stale registrations at a terminal; else a usage error. */
const sectionOrPick = (cwd: string, given: string | undefined) =>
	Effect.gen(function* () {
		if (given !== undefined) return given;
		if (!(yield* CliInteractive)) return yield* Effect.fail(ReposCli.missingArgument("section"));
		const drift = yield* Repos.ReposDrift;
		const stale = (yield* drift.check(cwd)).drifts.filter(
			(item) => item.kind === "localRegistrationDivergence" && item.manifestValue === undefined,
		);
		if (stale.length === 0) return yield* Effect.fail(ReposCli.missingArgument("section"));
		return yield* CliUi.prompt(
			Select.screen({
				message: "Deregister which stale registration?",
				choices: stale.map((item) => ({ label: item.name, value: item.name, detail: item.detail })),
			}),
		).pipe(Effect.catchTag("NotInteractive", () => Effect.fail(ReposCli.missingArgument("section"))));
	});

/**
 * Deregister handler; exported for tests. `section` is `undefined` when left off.
 *
 * @internal
 */
export const runReposDeregister = (cwd: string, section: string | undefined) =>
	Effect.gen(function* () {
		const target = yield* sectionOrPick(cwd, section);
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.deregister(cwd, target);
		yield* Report.print([
			Report.ok(
				`${result.section}: deregistered (${result.removedKeys.length} config keys removed)`,
				...result.removedKeys.map((key) => `removed ${key}`),
				"local git config only — nothing to commit",
			),
		]);
	}).pipe(
		Effect.catchTag(
			"ReposConfigError",
			ReposCli.fail(
				"deregister the submodule registration",
				"it still backs a manifest entry (use `savvy repos remove`), is not registered, or the manifest is unreadable; `savvy repos status --drift` lists the stale ones",
			),
		),
		Effect.catchTag("GitSubmoduleError", ReposCli.fail("deregister the submodule registration")),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposDeregister */
export const deregisterCommand = Command.make(
	"deregister",
	{ section: sectionArg, cwd: cwdOption },
	({ section, cwd }) => runReposDeregister(cwd, Option.getOrUndefined(section)),
).pipe(
	Command.withDescription(
		"Clear a stale submodule registration (a submodule.<section> section matching no manifest entry) from the local git config",
	),
);
/* v8 ignore stop */

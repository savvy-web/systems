/**
 * `repos status` command -- drift report for vendored `.repos/` submodules.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.status}: reports, per vendored
 * repo, whether the submodule is present, dirty, and whether any agent notes
 * have gone stale relative to the pinned ref. A `ReposConfigError` with kind
 * `"missing"` is the common, friendly case (nothing has been vendored yet) --
 * not an error -- so it is rendered as a plain message (or an empty JSON
 * report, in `--json` mode) with exit code 0. A `ReposConfigError` with kind
 * `"invalid"` means the manifest exists but is corrupt or unreadable -- that
 * is a real failure, logged and reported via a non-zero exit code.
 *
 * With `--drift`, {@link Repos.ReposDrift.check} also runs (after the status
 * check), reconciling the manifest, `.gitmodules`, the worktree, and `git
 * submodule status`. Each detected drift prints as one line
 * (`<name>: <kind> — <detail>`), and any drift flips the exit code to 1,
 * mirroring the existing `!clean` rule for the status report itself. Because
 * both calls read the same manifest, a missing manifest fails at the status
 * call before the drift check ever runs, so the friendly exit-0 case is
 * unaffected by `--drift`.
 *
 * @example
 * ```bash
 * savvy repos status
 * savvy repos status --json
 * savvy repos status --drift
 * ```
 *
 * @internal
 */

import { Repos } from "@savvy-web/silk-effects";
import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

/* v8 ignore start -- CLI option definitions */
const jsonOption = Flag.boolean("json").pipe(
	Flag.withDescription("Emit the structured drift report as JSON"),
	Flag.withDefault(false),
);
const driftOption = Flag.boolean("drift").pipe(
	Flag.withDescription("Also reconcile the manifest, .gitmodules, worktree, and git submodule status"),
	Flag.withDefault(false),
);
const cwdOption = Flag.directory("cwd").pipe(Flag.withDescription("Repo root to inspect"), Flag.withDefault("."));
/* v8 ignore stop */

/**
 * Drift report handler; exported for tests.
 *
 * @internal
 */
export const runReposStatus = (cwd: string, json: boolean, drift = false) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const report = yield* manager.status(cwd);
		if (!report.clean) {
			process.exitCode = 1;
		}

		let driftReport: Repos.ReposDriftReport | undefined;
		if (drift) {
			const reposDrift = yield* Repos.ReposDrift;
			driftReport = yield* reposDrift.check(cwd);
			if (!driftReport.clean) {
				process.exitCode = 1;
			}
		}

		if (json) {
			const payload = driftReport === undefined ? report : { ...report, drift: driftReport };
			yield* Console.log(JSON.stringify(payload, null, 2));
			return;
		}
		for (const repo of report.repos) {
			const flags = [
				repo.present ? undefined : "missing",
				repo.dirty ? "dirty" : undefined,
				repo.staleNoteIds.length > 0 ? `${repo.staleNoteIds.length} stale notes` : undefined,
			].filter((f): f is string => f !== undefined);
			yield* Effect.log(`${repo.name} @ ${repo.ref}${flags.length > 0 ? ` [${flags.join(", ")}]` : " [ok]"}`);
		}
		if (driftReport !== undefined) {
			for (const item of driftReport.drifts) {
				yield* Effect.log(`${item.name}: ${item.kind} — ${item.detail}`);
			}
		}
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) => {
			if (error.kind === "missing") {
				if (json) {
					return Console.log(JSON.stringify({ repos: [], clean: true }, null, 2));
				}
				return Effect.log("no .repos/config.json — nothing vendored");
			}
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposStatus */
export const statusCommand = Command.make(
	"status",
	{ json: jsonOption, drift: driftOption, cwd: cwdOption },
	({ json, drift, cwd }) => runReposStatus(cwd, json, drift),
).pipe(Command.withDescription("Drift report: gitlink vs manifest ref, dirty and unsynced submodules"));
/* v8 ignore stop */

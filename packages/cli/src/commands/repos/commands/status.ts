/**
 * `repos status` command -- drift report for vendored `.repos/` submodules.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.status}: reports, per vendored
 * repo, whether the submodule is present, dirty, and whether any agent notes
 * have gone stale relative to the pinned ref. An absent `.repos/config.json`
 * manifest is the common, friendly case (nothing has been vendored yet) --
 * not an error -- so `ReposConfigError` is caught and rendered as a plain
 * message with exit code 0.
 *
 * @example
 * ```bash
 * savvy repos status
 * savvy repos status --json
 * ```
 *
 * @internal
 */

import { Command, Options } from "@effect/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Console, Effect } from "effect";

/* v8 ignore start -- CLI option definitions */
const jsonOption = Options.boolean("json").pipe(
	Options.withDescription("Emit the structured drift report as JSON"),
	Options.withDefault(false),
);
const cwdOption = Options.directory("cwd").pipe(
	Options.withDescription("Repo root to inspect"),
	Options.withDefault("."),
);
/* v8 ignore stop */

/**
 * Drift report handler; exported for tests.
 *
 * @internal
 */
export const runReposStatus = (cwd: string, json: boolean) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const report = yield* manager.status(cwd);
		if (!report.clean) {
			process.exitCode = 1;
		}
		if (json) {
			yield* Console.log(JSON.stringify(report, null, 2));
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
	}).pipe(Effect.catchTag("ReposConfigError", () => Effect.log("no .repos/config.json — nothing vendored")));

/* v8 ignore start -- CLI registration; handler tested via runReposStatus */
export const statusCommand = Command.make("status", { json: jsonOption, cwd: cwdOption }, ({ json, cwd }) =>
	runReposStatus(cwd, json),
).pipe(Command.withDescription("Drift report: gitlink vs manifest ref, dirty and unsynced submodules"));
/* v8 ignore stop */

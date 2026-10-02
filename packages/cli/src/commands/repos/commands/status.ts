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

import type { Block } from "@effected/cli";
import { CliExit, Doc, Status } from "@effected/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Console, Effect } from "effect";
import { Command, Flag } from "effect/cli";
import type { CommandError } from "../../../internal/command-error.js";
import type { ReportEnv } from "../../../internal/report.js";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";

/** The human status report: a table of repos, and one of drifts under `--drift`. */
class ReposStatusView {
	private constructor() {}

	/** One row per repo: its name, pinned ref, and a status cell naming every flag it carries. */
	static readonly repos = (repos: Repos.ReposStatusReport["repos"]): Block =>
		Doc.table(
			[{ header: "name" }, { header: "ref" }, { header: "state" }],
			repos.map((repo) => {
				const flags = [
					repo.present ? undefined : "missing",
					repo.dirty ? "dirty" : undefined,
					repo.staleNoteIds.length > 0 ? `${repo.staleNoteIds.length} stale notes` : undefined,
				].filter((f): f is string => f !== undefined);
				const state =
					flags.length > 0
						? [Doc.status(Status.core, "warning"), ` ${flags.join(", ")}`]
						: [Doc.status(Status.core, "success"), " clean"];
				return [repo.name, repo.ref, state];
			}),
		);

	/** One row per drift: the repo, the drift kind, and what disagrees. */
	static readonly drifts = (drifts: Repos.ReposDriftReport["drifts"]): Block =>
		Doc.table(
			[{ header: "name" }, { header: "kind" }, { header: "detail" }],
			drifts.map((item) => [[Doc.status(Status.core, "failure"), ` ${item.name}`], item.kind, item.detail]),
		);
}

/* v8 ignore start -- CLI option definitions */
const jsonOption = Flag.Boolean("json").pipe(
	Flag.withDescription("Emit the structured drift report as JSON"),
	Flag.withDefault(false),
);
const driftOption = Flag.Boolean("drift").pipe(
	Flag.withDescription("Also reconcile the manifest, .gitmodules, worktree, and git submodule status"),
	Flag.withDefault(false),
);
const cwdOption = Flag.Directory("cwd").pipe(Flag.withDescription("Repo root to inspect"), Flag.withDefault("."));
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
			yield* CliExit.set(1);
		}

		let driftReport: Repos.ReposDriftReport | undefined;
		if (drift) {
			const reposDrift = yield* Repos.ReposDrift;
			driftReport = yield* reposDrift.check(cwd);
			if (!driftReport.clean) {
				yield* CliExit.set(1);
			}
		}

		if (json) {
			const payload = driftReport === undefined ? report : { ...report, drift: driftReport };
			yield* Console.log(JSON.stringify(payload, null, 2));
			return;
		}
		const blocks: Array<Block> = [
			report.repos.length > 0 ? ReposStatusView.repos(report.repos) : Report.skip("the manifest lists no repos"),
		];
		if (driftReport !== undefined && driftReport.drifts.length > 0) {
			blocks.push(Report.line(""), Report.heading("drift"), ReposStatusView.drifts(driftReport.drifts));
		}
		yield* Report.print(blocks);
	}).pipe(
		Effect.catchTag("ReposConfigError", (error): Effect.Effect<void, CommandError, CliExit | ReportEnv> => {
			if (error.kind === "missing") {
				if (json) {
					return Console.log(JSON.stringify({ repos: [], clean: true }, null, 2));
				}
				return Report.print([Report.skip("no .repos/config.json — nothing vendored")]);
			}
			// Under --json the drift monitor parses stdout, so the failure is a JSON
			// document there, exactly as it has always been; the message goes to stderr.
			if (json) {
				return CliExit.set(1).pipe(
					Effect.andThen(Console.log(JSON.stringify({ error: error.message, clean: false }, null, 2))),
					Effect.andThen(Effect.logError(error.message)),
				);
			}
			return ReposCli.fail("read the repos manifest")(error);
		}),
		// A git failure (status or --drift) still leaves a --json consumer one document;
		// without --json it fails as a CommandError, which CliRuntime draws on stderr.
		Effect.catchTag("GitSubmoduleError", (error) =>
			json
				? CliExit.set(1).pipe(
						Effect.andThen(Console.log(JSON.stringify({ error: error.message, clean: false }, null, 2))),
						Effect.andThen(Effect.logError(error.message)),
					)
				: ReposCli.fail("check the vendored repos")(error),
		),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposStatus */
export const statusCommand = Command.make(
	"status",
	{ json: jsonOption, drift: driftOption, cwd: cwdOption },
	({ json, drift, cwd }) => runReposStatus(cwd, json, drift),
).pipe(Command.withDescription("Drift report: gitlink vs manifest ref, dirty and unsynced submodules"));
/* v8 ignore stop */

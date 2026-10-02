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
 * tree failed -- all four are real failures, failing as a `CommandError`
 * (exit 1) with a hint.
 *
 * Both positionals are optional to the parser so a person can leave them off:
 * at a terminal a missing name is picked from the vendored repos (`Select`)
 * and a missing ref typed (`TextInput`, starting at the current pin). Anywhere
 * else (an agent, CI, a pipe) a missing one is the usage error it always was,
 * exit 64, and nothing is read.
 *
 * @example
 * ```bash
 * savvy repos pin my-repo v2.0.0
 * ```
 *
 * @internal
 */

import { CliInteractive, Doc } from "@effected/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";

/* v8 ignore start -- CLI option/arg definitions */
const nameArg = Argument.String("name").pipe(Argument.optional);
const refArg = Argument.String("ref").pipe(Argument.optional);
const cwdOption = Flag.Directory("cwd").pipe(Flag.withDescription("Repo root to pin within"), Flag.withDefault("."));
/* v8 ignore stop */

/**
 * Pin handler; exported for tests. `name`/`ref` are `undefined` when left off.
 *
 * @internal
 */
export const runReposPin = (cwd: string, name: string | undefined, ref: string | undefined) =>
	Effect.gen(function* () {
		const target = yield* ReposCli.nameOrPick(cwd, name, {
			command: ["pin"],
			argument: "name",
			message: "Re-pin which repo?",
		});
		// The current pin seeds the ref prompt; read only when someone can be asked.
		const current =
			ref === undefined && (yield* CliInteractive)
				? (yield* ReposCli.vendored(cwd)).find((repo) => repo.name === target)?.ref
				: undefined;
		const newRef = yield* ReposCli.textOrAsk(ref, {
			command: ["pin"],
			argument: "ref",
			message: `Re-pin ${target} to which ref? (tag, branch, or commit)`,
			initial: current,
		});
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.pin(cwd, target, newRef);
		yield* Report.print([
			Report.ok(
				`${result.name}: ${result.oldCommit ?? "unknown"} -> ${result.newCommit}`,
				"staged — review and commit",
			),
			Doc.codeBlock(result.commitMessage),
			...result.staleNoteIds.map((staleId) => Report.warn(`note ${staleId} is now stale against ${newRef}`)),
		]);
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) =>
			error.kind === "missing" ? ReposCli.nothingVendored : ReposCli.fail("re-pin the repo")(error),
		),
		Effect.catchTag(["GitSubmoduleError", "RepoNotFoundError", "ReposLockdownError"], ReposCli.fail("re-pin the repo")),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposPin */
export const pinCommand = Command.make("pin", { name: nameArg, ref: refArg, cwd: cwdOption }, ({ name, ref, cwd }) =>
	runReposPin(cwd, Option.getOrUndefined(name), Option.getOrUndefined(ref)),
).pipe(Command.withDescription("Re-pin a vendored repo to a new ref; stages the change without committing"));
/* v8 ignore stop */

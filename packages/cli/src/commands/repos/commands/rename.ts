/**
 * `repos rename` command -- rename a vendored `.repos/` submodule's manifest
 * key and worktree.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.rename}: moves the worktree
 * (`git mv`), re-points the module gitdir's `core.worktree` values,
 * canonicalizes the `.gitmodules` section name, and renames the manifest
 * key -- it does not commit, so the caller reviews and commits the staged
 * rename with the ready-made message the result carries.
 *
 * A `ReposConfigError` with kind `"missing"` -- nothing vendored yet -- is
 * the common, friendly case and always exits 0. A `ReposConfigError` with
 * kind `"invalid"` means either the manifest exists but is corrupt/unreadable
 * OR the requested new name is invalid/already vendored. `RepoNotFoundError`
 * means the old name isn't in the manifest -- this is a REAL failure, since
 * renaming a name that was never vendored is almost always a typo the caller
 * should see. `GitSubmoduleError` means the underlying git command failed,
 * and `ReposLockdownError` means the OS-permission lockdown pass on a
 * vendored tree failed -- all four (invalid config, not-found, git failure,
 * lockdown failure) are real failures, failing as a `CommandError` (exit 1)
 * with a hint.
 *
 * Both positionals are optional to the parser so a person can leave them off:
 * at a terminal a missing old name is picked from the vendored repos
 * (`Select`) and a missing new name typed (`TextInput`). Anywhere else a
 * missing one is the usage error it always was, exit 64.
 *
 * @example
 * ```bash
 * savvy repos rename old-name new-name
 * ```
 *
 * @internal
 */

import { Doc } from "@effected/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";

/* v8 ignore start -- CLI option/arg definitions */
const oldNameArg = Argument.String("old-name").pipe(Argument.optional);
const newNameArg = Argument.String("new-name").pipe(Argument.optional);
const cwdOption = Flag.Directory("cwd").pipe(Flag.withDescription("Repo root to rename within"), Flag.withDefault("."));
/* v8 ignore stop */

/**
 * Rename handler; exported for tests. Either name is `undefined` when left off.
 *
 * @internal
 */
export const runReposRename = (cwd: string, oldName: string | undefined, newName: string | undefined) =>
	Effect.gen(function* () {
		const from = yield* ReposCli.nameOrPick(cwd, oldName, {
			command: ["rename"],
			argument: "old-name",
			message: "Rename which repo?",
		});
		const to = yield* ReposCli.textOrAsk(newName, {
			command: ["rename"],
			argument: "new-name",
			message: `Rename ${from} to?`,
		});
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.rename(cwd, from, to);
		yield* Report.print([
			Report.ok(`${result.oldName}: renamed to ${result.newName} (${result.path})`, "staged — review and commit"),
			Doc.codeBlock(result.commitMessage),
		]);
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) =>
			error.kind === "missing"
				? ReposCli.nothingVendored
				: ReposCli.fail(
						"rename the repo",
						"the manifest is unreadable, or the new name is invalid or already vendored; run `savvy repos status`",
					)(error),
		),
		Effect.catchTag(["RepoNotFoundError", "GitSubmoduleError", "ReposLockdownError"], ReposCli.fail("rename the repo")),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposRename */
export const renameCommand = Command.make(
	"rename",
	{ oldName: oldNameArg, newName: newNameArg, cwd: cwdOption },
	({ oldName, newName, cwd }) => runReposRename(cwd, Option.getOrUndefined(oldName), Option.getOrUndefined(newName)),
).pipe(
	Command.withDescription("Rename a vendored repo's manifest key and worktree; stages the change without committing"),
);
/* v8 ignore stop */

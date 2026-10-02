/**
 * `repos remove` command -- unvendor a `.repos/` submodule.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.remove}: deinitializes and
 * removes the submodule's gitlink, worktree, and module gitdir, drops its
 * `.gitmodules` section, and removes the manifest entry -- it does not
 * commit, so the caller reviews and commits the staged removal with the
 * ready-made message the result carries. Any notes the entry carried are
 * surfaced in the result so a durable one can be promoted elsewhere first.
 *
 * A `ReposConfigError` with kind `"missing"` -- nothing vendored yet -- is
 * the common, friendly case and always exits 0. A `ReposConfigError` with
 * kind `"invalid"` means the manifest exists but is corrupt or unreadable.
 * `RepoNotFoundError` means the named repo isn't in the manifest -- this is
 * a REAL failure (unlike the "missing manifest" case above), since removing
 * a name that was never vendored is almost always a typo the caller should
 * see. `GitSubmoduleError` means the underlying git command failed, and
 * `ReposLockdownError` means the OS-permission lockdown pass on a vendored
 * tree failed -- all four (invalid config, not-found, git failure, lockdown
 * failure) are real failures, failing as a `CommandError` (exit 1) with a
 * hint.
 *
 * At a terminal it asks before removing (`Confirm`; `--yes` skips it), and a
 * missing name is picked from the vendored repos (`Select`). Declining prints
 * `remove cancelled — <name> left vendored` and exits 0 with nothing changed.
 * Anywhere else (an agent, CI, a pipe) it proceeds unasked, as it always did,
 * and a missing name is the usage error it always was, exit 64.
 *
 * @example
 * ```bash
 * savvy repos remove my-repo
 * savvy repos remove my-repo --yes
 * ```
 *
 * @internal
 */

import type { Block } from "@effected/cli";
import { Doc } from "@effected/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { confirmDestructive, yesFlag } from "../../../internal/confirm.js";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";

/* v8 ignore start -- CLI option/arg definitions */
const nameArg = Argument.String("name").pipe(Argument.optional);
const cwdOption = Flag.Directory("cwd").pipe(Flag.withDescription("Repo root to remove within"), Flag.withDefault("."));
/* v8 ignore stop */

/** Options for {@link runReposRemove}. */
export interface ReposRemoveOptions {
	/** `--yes`: proceed without asking. */
	readonly yes?: boolean | undefined;
}

/**
 * Remove handler; exported for tests. `name` is `undefined` when left off.
 *
 * @internal
 */
export const runReposRemove = (cwd: string, name: string | undefined, options: ReposRemoveOptions = {}) =>
	Effect.gen(function* () {
		const target = yield* ReposCli.nameOrPick(cwd, name, { argument: "name", message: "Unvendor which repo?" });
		const proceed = yield* confirmDestructive({
			message: `Remove ${target} from .repos/? (staged, not committed)`,
			yes: options.yes === true,
		});
		if (!proceed) {
			return yield* Report.print([Report.skip(`remove cancelled — ${target} left vendored`)]);
		}
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.remove(cwd, target);
		const blocks: Array<Block> = [
			Report.ok(`${result.name}: removed (${result.path})`, "staged — review and commit"),
			Doc.codeBlock(result.commitMessage),
		];
		const lost: Array<Block> = result.removedNotes.map((note) =>
			Doc.paragraph(`note ${note.id} (${note.ref}) was removed with the entry — promote it first if it is durable`),
		);
		// `add` has an `orientation` parameter but does not resurrect anything on
		// its own, so anyone re-vendoring after this loses the block unless they
		// are handed it here, while it still exists.
		if (result.removedEntry.orientation) {
			lost.push(
				Doc.paragraph(
					`the orientation block for ${result.name} was removed with the entry and add will NOT restore it — re-vendoring? capture it now:`,
				),
				Doc.codeBlock(JSON.stringify(result.removedEntry.orientation, null, 2), "json"),
			);
		}
		if (lost.length > 0) {
			blocks.push(Doc.callout("warning", lost));
		}
		yield* Report.print(blocks);
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) =>
			error.kind === "missing" ? ReposCli.nothingVendored : ReposCli.fail("remove the repo")(error),
		),
		Effect.catchTag(["RepoNotFoundError", "GitSubmoduleError", "ReposLockdownError"], ReposCli.fail("remove the repo")),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposRemove */
export const removeCommand = Command.make(
	"remove",
	{ name: nameArg, yes: yesFlag, cwd: cwdOption },
	({ name, yes, cwd }) => runReposRemove(cwd, Option.getOrUndefined(name), { yes }),
).pipe(Command.withDescription("Unvendor a repo under .repos/; stages the removal without committing"));
/* v8 ignore stop */

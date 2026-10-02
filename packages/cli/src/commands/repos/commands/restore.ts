/**
 * `repos restore` command -- hard-reset one or more vendored `.repos/`
 * submodules back to their pinned gitlink commit.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.restore}: explicit only --
 * never invoked by `sync` or any other implicit path. DESTRUCTIVE to
 * uncommitted worktree edits and untracked files in the repos it touches:
 * each targeted repo is hard-reset to its staged gitlink commit (falling
 * back to the committed one) and its sparse-checkout paths re-applied.
 * With one or more `name` arguments, exactly those repos are restored, even
 * if already clean -- an explicit ask is always honored. With no names, every
 * DIRTY repo (per `status`) is restored and the clean ones are reported as
 * skipped.
 *
 * A `ReposConfigError` with kind `"missing"` -- nothing vendored yet -- is
 * the common, friendly case and always exits 0. A `ReposConfigError` with
 * kind `"invalid"` means the manifest exists but is corrupt or unreadable.
 * `RepoNotFoundError` means an explicitly named repo isn't in the manifest --
 * a real failure, since restoring a name that was never vendored is almost
 * always a typo the caller should see. `GitSubmoduleError` means the
 * underlying git command failed (including the case where a repo has
 * neither a staged nor a committed gitlink commit to restore to), and
 * `ReposLockdownError` means the OS-permission lockdown pass on a vendored
 * tree failed -- all four are real failures, failing as a `CommandError`
 * (exit 1) with a hint.
 *
 * At a terminal it asks first. With no names, the dirty repos are offered on a
 * `MultiSelect`, all preselected (choosing none prints `nothing selected —
 * left unchanged`, exit 0); then a `Confirm` (`--yes` skips it) whose refusal
 * prints `restore cancelled — nothing changed`, exit 0. With names, only the
 * `Confirm`. Anywhere else (an agent, CI, a pipe) nothing is asked and it
 * behaves exactly as it always did.
 *
 * @example
 * ```bash
 * savvy repos restore my-repo
 * savvy repos restore my-repo other-repo
 * savvy repos restore
 * savvy repos restore --yes
 * ```
 *
 * @internal
 */

import type { Block } from "@effected/cli";
import { CliExit, CliInteractive } from "@effected/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { confirmDestructive, yesFlag } from "../../../internal/confirm.js";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";

/* v8 ignore start -- CLI option/arg definitions */
const namesArg = Argument.String("name").pipe(Argument.variadic());
const cwdOption = Flag.Directory("cwd").pipe(
	Flag.withDescription("Repo root to restore within"),
	Flag.withDefault("."),
);
/* v8 ignore stop */

/** Options for {@link runReposRestore}. */
export interface ReposRestoreOptions {
	/** `--yes`: proceed without asking. */
	readonly yes?: boolean | undefined;
}

/** Which repos to restore: the names given, or (at a terminal, with none given) the dirty ones a person picks. */
const choose = (cwd: string, names: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		if (names.length > 0 || !(yield* CliInteractive)) return { names, asked: false };
		const dirty = (yield* ReposCli.vendored(cwd)).filter((repo) => repo.dirty).map((repo) => repo.name);
		// Nothing dirty: let the manager report every repo as skipped-clean, as it always has.
		if (dirty.length === 0) return { names, asked: false };
		return { names: yield* ReposCli.pickDirty(dirty), asked: true };
	});

/**
 * Restore handler; exported for tests.
 *
 * @internal
 */
export const runReposRestore = (cwd: string, names: ReadonlyArray<string>, options: ReposRestoreOptions = {}) =>
	Effect.gen(function* () {
		const chosen = yield* choose(cwd, names);
		if (chosen.asked && chosen.names.length === 0) {
			return yield* Report.print([Report.skip("nothing selected — left unchanged")]);
		}
		const targets = chosen.names;
		// No targets is the restore-every-dirty-repo form: at a terminal it is only
		// reached when nothing is dirty, so there is nothing to confirm; anywhere
		// else nothing is ever asked.
		if (targets.length > 0) {
			const proceed = yield* confirmDestructive({
				message: `Hard-reset ${targets.join(", ")}? Uncommitted edits and untracked files there are lost.`,
				yes: options.yes === true,
			});
			if (!proceed) {
				return yield* Report.print([Report.skip("restore cancelled — nothing changed")]);
			}
		}
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.restore(cwd, targets.length > 0 ? targets : undefined);
		const blocks: Array<Block> = [
			...result.restored.map((entry) => Report.ok(`${entry.name}: restored to ${entry.commit}`)),
			...result.skippedClean.map((name) => Report.skip(`${name}: clean — skipped`)),
		];
		// Reporting a reset that ran while the tree stayed dirty as a plain
		// success is what let a nested-submodule divergence look repaired for
		// months. Say it, and set a failing exit code so a script notices.
		for (const name of result.stillDirty) {
			blocks.push(
				Report.fail(`${name}: reset ran but the worktree is STILL dirty; run \`savvy repos status --drift\``),
			);
		}
		if (result.stillDirty.length > 0) {
			yield* CliExit.set(1);
		}
		if (result.restored.length === 0 && result.skippedClean.length === 0) {
			blocks.push(Report.ok("nothing to restore"));
		}
		yield* Report.print(blocks);
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) =>
			error.kind === "missing" ? ReposCli.nothingVendored : ReposCli.fail("restore the vendored repos")(error),
		),
		Effect.catchTag(
			["RepoNotFoundError", "GitSubmoduleError", "ReposLockdownError"],
			ReposCli.fail("restore the vendored repos"),
		),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposRestore */
export const restoreCommand = Command.make(
	"restore",
	{ names: namesArg, yes: yesFlag, cwd: cwdOption },
	({ names, yes, cwd }) => runReposRestore(cwd, names, { yes }),
).pipe(
	Command.withDescription(
		"Hard-reset vendored repos to their pinned commit; DESTRUCTIVE to uncommitted worktree edits. Given no names, restores every dirty repo (asks first at a terminal)",
	),
);
/* v8 ignore stop */

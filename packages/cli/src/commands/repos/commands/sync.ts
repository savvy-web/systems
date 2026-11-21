/**
 * `repos sync` command -- reconcile vendored `.repos/` submodules with the manifest.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.sync}: initializes missing
 * submodules, re-applies sparse-checkout patterns, advances a populated
 * clean checkout onto a moved gitlink (a dirty one is reported, not
 * clobbered), clears stale git locks
 * left behind by an interrupted fetch, reconciles a submodule's URL when it
 * drifts from the manifest, and registers an orphan manifest entry (no
 * gitlink at all) from scratch. Sync is idempotent repair, so
 * a `ReposConfigError` with kind `"missing"` -- the common, friendly case
 * (nothing to sync yet) -- always exits 0. A `ReposConfigError` with kind
 * `"invalid"` means the manifest exists but is corrupt or unreadable,
 * `GitSubmoduleError` means the underlying git command failed, and
 * `ReposLockdownError` means the OS-permission lockdown pass on a vendored
 * tree failed -- all three are real failures, failing as a `CommandError`
 * (exit 1) with a hint.
 *
 * Each repo's lines print as that repo finishes (from the manager's
 * `onStep`), so a run that fails part-way still shows what already landed.
 *
 * Never asks anything, at a terminal or not: the session hook runs it under a
 * watchdog, so a prompt would hang it. A person at a terminal also gets a
 * live progress view (the done/total count and the current repo), whose
 * module is imported only on that path; the hook's piped run prints the
 * per-repo lines alone and never loads React or Ink.
 *
 * @example
 * ```bash
 * savvy repos sync
 * ```
 *
 * @internal
 */

import type { Block } from "@effected/cli-kit";
import { CliInteractive } from "@effected/cli-kit";
import { CliUi } from "@effected/cli-kit/ui";
import { Repos } from "@savvy-web/silk-effects";
import { Console, Effect, PubSub } from "effect";
import { Command, Flag } from "effect/cli";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";
import type { SyncEvent } from "../sync/progress.js";

/* v8 ignore start -- CLI option definitions */
const cwdOption = Flag.Directory("cwd").pipe(Flag.withDescription("Repo root to sync"), Flag.withDefault("."));
/* v8 ignore stop */

/** The block each actionable action prints, in the order a repo's lines print. */
const actionLines: ReadonlyArray<readonly [Repos.ReposSyncAction, (name: string) => Block]> = [
	["clearedLock", (name) => Report.ok(`${name}: cleared stale lock`)],
	["initialized", (name) => Report.ok(`${name}: initialized`)],
	["sparseApplied", (name) => Report.ok(`${name}: sparse-checkout applied`)],
	["advanced", (name) => Report.ok(`${name}: advanced to recorded gitlink`)],
	[
		"skippedDirty",
		(name) => Report.warn(`${name}: worktree dirty, gitlink moved — not advanced`, `run savvy repos restore ${name}`),
	],
	["urlSynced", (name) => Report.ok(`${name}: url reconciled`)],
	["registered", (name) => Report.ok(`${name}: registered`)],
];

/**
 * One repo's lines, one per actionable action. `upToDate` prints nothing, and
 * `boundaryMarked` is not an action at all: `sync` re-asserts the boundary
 * marker on EVERY entry on EVERY run, so it is never news, and logging it
 * would print a line per repo on every no-op sync and suppress the "up to
 * date" line. It stays in the structured report for callers that want to
 * verify the assertion.
 *
 * @internal
 */
export const repoBlocks = (name: string, actions: ReadonlyArray<Repos.ReposSyncAction>): ReadonlyArray<Block> =>
	actionLines.filter(([action]) => actions.includes(action)).map(([, line]) => line(name));

/**
 * The sync, printing each repo's lines as it finishes, then the "up to date"
 * line when no repo printed any. `onStep` sees every step, after its repo's
 * lines print.
 */
const syncPrinting = <R>(
	manager: Repos.ReposManagerShape,
	cwd: string,
	onStep: (step: Repos.ReposSyncStep) => Effect.Effect<void, never, R>,
) =>
	Effect.gen(function* () {
		let printedAny = false;
		yield* manager.sync(cwd, {
			onStep: (step) =>
				Effect.gen(function* () {
					if (step._tag === "RepoSynced") {
						const blocks = repoBlocks(step.name, step.actions);
						if (blocks.length > 0) {
							printedAny = true;
							yield* Report.print(blocks);
						}
					}
					yield* onStep(step);
				}),
		});
		if (!printedAny) {
			yield* Report.print([Report.ok("all vendored repos up to date")]);
		}
	});

/**
 * The sync under a live view, for a person at a terminal.
 *
 * @remarks
 * The view's module (the JSX) is imported here, on the one path that draws,
 * so no other run loads React. Every line the sync prints goes through the
 * view's `logConsole`, landing above the frame instead of tearing it. A sync
 * that fails part-way still closes the view, committing the frame as drawn.
 */
const syncLive = (manager: Repos.ReposManagerShape, cwd: string) =>
	Effect.scoped(
		Effect.gen(function* () {
			const { syncView } = yield* Effect.promise(() => import("../sync/view.js"));
			const pubsub = yield* PubSub.unbounded<SyncEvent>();
			const events = yield* PubSub.subscribe(pubsub);
			const view = yield* CliUi.live({ ...syncView, events });
			yield* syncPrinting(manager, cwd, (step) => PubSub.publish(pubsub, step)).pipe(
				Effect.andThen(PubSub.publish(pubsub, { _tag: "Ended" })),
				Effect.provideService(Console.Console, view.logConsole),
				Effect.ensuring(view.close),
			);
		}),
	);

/**
 * Sync handler; exported for tests.
 *
 * @internal
 */
export const runReposSync = (cwd: string) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		if (yield* CliInteractive) {
			yield* syncLive(manager, cwd);
		} else {
			yield* syncPrinting(manager, cwd, () => Effect.void);
		}
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) =>
			error.kind === "missing" ? ReposCli.nothingVendored : ReposCli.fail("sync the vendored repos")(error),
		),
		Effect.catchTag(["GitSubmoduleError", "ReposLockdownError"], ReposCli.fail("sync the vendored repos")),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposSync */
export const syncCommand = Command.make("sync", { cwd: cwdOption }, ({ cwd }) => runReposSync(cwd)).pipe(
	Command.withDescription(
		"Reconcile vendored submodules with the manifest: init missing, advance moved gitlinks, apply sparse, clear locks",
	),
);
/* v8 ignore stop */

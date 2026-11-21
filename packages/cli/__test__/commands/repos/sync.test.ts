import { describe, expect, it } from "@effect/vitest";
import { CliUiTest } from "@effected/cli-kit/ui/testing";
import type { Repos } from "@savvy-web/silk-effects";
import { Effect, Fiber } from "effect";

import { runReposSync } from "../../../src/commands/repos/commands/sync.js";
import type { SyncEvent } from "../../../src/commands/repos/sync/progress.js";
import { initialSyncState, reduceSync } from "../../../src/commands/repos/sync/progress.js";
import { syncView } from "../../../src/commands/repos/sync/view.js";
import { Capture } from "../../utils/capture.js";
import { Interactive } from "../../utils/interactive.js";
import { ReposStub } from "./fixtures.js";

/** Steps for a run where every actionable action fired across seven repos, plus one idle repo. */
const activeSteps: ReadonlyArray<Repos.ReposSyncStep> = [
	{ _tag: "Started", repos: ["foo", "bar", "baz", "adv", "dirt", "qux", "quux", "idle"] } as Repos.ReposSyncStep,
	ReposStub.synced("foo", ["clearedLock", "upToDate"]),
	ReposStub.synced("bar", ["initialized", "sparseApplied"]),
	ReposStub.synced("baz", ["upToDate", "sparseApplied"]),
	ReposStub.synced("adv", ["advanced"]),
	ReposStub.synced("dirt", ["skippedDirty"]),
	ReposStub.synced("qux", ["urlSynced"]),
	ReposStub.synced("quux", ["registered"]),
	ReposStub.synced("idle", ["upToDate"]),
];

/** Steps for a run where nothing needed reconciling. */
const idleSteps: ReadonlyArray<Repos.ReposSyncStep> = [
	{ _tag: "Started", repos: ["foo"] } as Repos.ReposSyncStep,
	{ _tag: "RepoStarted", name: "foo" } as Repos.ReposSyncStep,
	ReposStub.synced("foo", ["upToDate"]),
];

const sync = (
	steps: ReadonlyArray<Repos.ReposSyncStep>,
	end?: Effect.Effect<
		Repos.ReposSyncReport,
		Repos.ReposConfigError | Repos.GitSubmoduleError | Repos.ReposLockdownError
	>,
) => runReposSync("/repo").pipe(Effect.provide(ReposStub.manager({ sync: ReposStub.sync(steps, end) })));

const activeLines = [
	"✓ foo: cleared stale lock",
	"✓ bar: initialized",
	"✓ bar: sparse-checkout applied",
	"✓ baz: sparse-checkout applied",
	"✓ adv: advanced to recorded gitlink",
	"⚠ dirt: worktree dirty, gitlink moved — not advanced",
	"  run savvy repos restore dirt",
	"✓ qux: url reconciled",
	"✓ quux: registered",
];

describe("repos sync", () => {
	it.effect("prints each repo's actionable lines as that repo finishes, exit 0", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(sync(activeSteps));
			expect(result.stdout).toEqual([
				"✓ foo: cleared stale lock",
				["✓ bar: initialized", "✓ bar: sparse-checkout applied"].join("\n"),
				"✓ baz: sparse-checkout applied",
				"✓ adv: advanced to recorded gitlink",
				["⚠ dirt: worktree dirty, gitlink moved — not advanced", "  run savvy repos restore dirt"].join("\n"),
				"✓ qux: url reconciled",
				"✓ quux: registered",
			]);
			expect(result.exitCode).toBe(0);
		}),
	);

	it.effect("says up to date when nothing changed (boundaryMarked is not news)", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(sync(idleSteps));
			expect(result.stdout).toEqual(["✓ all vendored repos up to date"]);
		}),
	);

	it.effect("an advanced or dirty-skipped repo alone is news, never 'up to date'", () =>
		Effect.gen(function* () {
			const advancedOnly = yield* Capture.run(
				sync([{ _tag: "Started", repos: ["foo"] } as Repos.ReposSyncStep, ReposStub.synced("foo", ["advanced"])]),
			);
			expect(advancedOnly.stdout).toEqual(["✓ foo: advanced to recorded gitlink"]);

			const dirtyOnly = yield* Capture.run(
				sync([{ _tag: "Started", repos: ["foo"] } as Repos.ReposSyncStep, ReposStub.synced("foo", ["skippedDirty"])]),
			);
			const dirtyText = dirtyOnly.stdout.join("\n");
			expect(dirtyText).toContain("⚠ foo: worktree dirty, gitlink moved — not advanced");
			expect(dirtyText).toContain("run savvy repos restore foo");
			expect(dirtyText).not.toContain("up to date");
			expect(dirtyOnly.exitCode).toBe(0);
		}),
	);

	it.effect("a failure part-way leaves the finished repo's lines on stdout, exit 1", () =>
		Effect.gen(function* () {
			const result = yield* Capture.main(
				sync(
					[{ _tag: "Started", repos: ["foo", "bar"] } as Repos.ReposSyncStep, ReposStub.synced("foo", ["initialized"])],
					Effect.fail(ReposStub.git("fatal: could not fetch")),
				),
			);
			expect(result.stdout.join("\n")).toContain("✓ foo: initialized");
			expect(result.stdout.join("\n")).not.toContain("up to date");
			expect(result.exitCode).toBe(1);
			expect(result.stderr.join("\n")).toContain("✗ could not sync the vendored repos");
		}),
	);

	// The session hook runs sync under a watchdog: a prompt would hang it, so
	// a terminal gets a progress view (never a prompt), and a pipe gets neither.
	it.effect("mounts one live view at a terminal and still prints each repo's lines", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(sync(activeSteps));
			const result = yield* Fiber.join(fiber);
			expect(yield* session.mounts).toBe(1);
			const frame = yield* (yield* session.next()).plainFrame;
			expect(frame).toContain("8 synced");
			expect(frame).toContain("7 changed");
			// Each repo's lines went through the view's console, above the frame,
			// not to the program's own stdout.
			expect(result.stdout).toEqual([]);
			const transcript = yield* session.transcript;
			for (const line of activeLines) expect(transcript).toContain(line);
			expect(result.exitCode).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("a non-terminal run never mounts (session-hook path)", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(sync(activeSteps), { interactive: false });
			const result = yield* Fiber.join(fiber);
			expect(yield* session.mounts).toBe(0);
			expect(result.stdout.join("\n")).toEqual(activeLines.join("\n"));
		}).pipe(Effect.scoped),
	);

	it.effect("with no manifest it says nothing is vendored and exits 0", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(sync([], Effect.fail(ReposStub.configMissing)));
			expect(result.stdout).toEqual(["↷ no .repos/config.json — nothing vendored"]);
			expect(result.exitCode).toBe(0);
		}),
	);

	it.effect("each repos failure is a CommandError with a hint on stderr, exit 1, stdout empty", () =>
		Effect.gen(function* () {
			for (const [error, expected, hint] of [
				[ReposStub.configInvalid("invalid JSON"), "invalid JSON", "TIP: fix .repos/config.json"],
				[ReposStub.git("fatal: could not fetch"), "  fatal: could not fetch", "TIP: run `savvy repos status --drift`"],
				[ReposStub.lockdown("chmod failed: EACCES"), "chmod failed: EACCES", "TIP: run `savvy repos sync`"],
			] as const) {
				const result = yield* Capture.main(sync([], Effect.fail(error)));
				expect(result.exitCode).toBe(1);
				expect(result.stdout).toEqual([]);
				const stderr = result.stderr.join("\n");
				expect(stderr).toContain("✗ could not sync the vendored repos");
				expect(stderr).toContain(expected);
				expect(stderr).toContain(hint);
			}
		}),
	);
});

describe("repos sync live view", () => {
	it("folds steps into done/total and the changed count, and a start begins afresh", () => {
		const events: ReadonlyArray<SyncEvent> = [
			{ _tag: "Started", repos: ["a", "b"] } as SyncEvent,
			{ _tag: "RepoStarted", name: "a" } as SyncEvent,
			ReposStub.synced("a", ["initialized"]),
			{ _tag: "RepoStarted", name: "b" } as SyncEvent,
		];
		const running = events.reduce(reduceSync, initialSyncState);
		expect(running).toMatchObject({ phase: "running", total: 2, finished: 1, current: "b", changed: 1 });
		const done = [ReposStub.synced("b", ["upToDate"]), { _tag: "Ended" } as const].reduce(reduceSync, running);
		expect(done).toMatchObject({ phase: "done", finished: 2, changed: 1, current: undefined });
		expect(reduceSync(done, { _tag: "Started", repos: ["c"] } as SyncEvent)).toMatchObject({
			phase: "running",
			total: 1,
			finished: 0,
			changed: 0,
		});
	});

	it.effect("shows the current repo and done/total while running, then commits the counts", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({ ...syncView, color: "none", columns: 100 });
			yield* view.publish({ _tag: "Started", repos: ["a", "b"] } as SyncEvent);
			yield* view.publish({ _tag: "RepoStarted", name: "a" } as SyncEvent);
			expect(yield* view.plainFrame).toContain("Syncing a (0/2 repos)");
			yield* view.publish(ReposStub.synced("a", ["registered"]));
			yield* view.publish({ _tag: "RepoStarted", name: "b" } as SyncEvent);
			expect(yield* view.plainFrame).toContain("Syncing b (1/2 repos)");
			yield* view.publish(ReposStub.synced("b", ["upToDate"]));
			yield* view.publish({ _tag: "Ended" });
			yield* view.end;
			const transcript = yield* view.transcript;
			expect(transcript).toContain("2 synced");
			expect(transcript).toContain("1 changed");
		}).pipe(Effect.scoped),
	);
});

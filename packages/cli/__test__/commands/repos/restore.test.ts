import { describe, expect, it } from "@effect/vitest";
import type { Repos } from "@savvy-web/silk-effects";
import { Effect, Fiber } from "effect";

import { runReposRestore } from "../../../src/commands/repos/commands/restore.js";
import { Capture } from "../../utils/capture.js";
import { Interactive } from "../../utils/interactive.js";
import { ReposStub } from "./fixtures.js";

/** A manager listing two dirty repos and one clean one, recording what `restore` was asked for. */
const recording = (result?: Repos.ReposRestoreResult) => {
	const calls: Array<{ readonly root: string; readonly names: ReadonlyArray<string> | undefined }> = [];
	const layer = ReposStub.manager({
		status: () =>
			Effect.succeed(ReposStub.status([{ name: "foo", dirty: true }, { name: "bar" }, { name: "baz", dirty: true }])),
		restore: (root, names) => {
			calls.push({ root, names });
			return Effect.succeed(
				result ?? {
					restored: (names ?? ["foo", "baz"]).map((name) => ({ name, commit: "abc111" })),
					skippedClean: names === undefined ? ["bar"] : [],
					stillDirty: [],
				},
			);
		},
	});
	return { calls, layer };
};

describe("repos restore — a run that cannot prompt (unchanged)", () => {
	it.effect("with no names restores every dirty repo without reading status or mounting anything", () =>
		Effect.gen(function* () {
			// `status` is never needed off a terminal: the manager picks the dirty repos itself.
			const calls: Array<ReadonlyArray<string> | undefined> = [];
			const layer = ReposStub.manager({
				restore: (_root, names) => {
					calls.push(names);
					return Effect.succeed({
						restored: [{ name: "dirty-spec", commit: "abc111" }],
						skippedClean: ["clean-spec"],
						stillDirty: [],
					});
				},
			});
			const { session, fiber } = yield* Interactive.run(runReposRestore("/repo", []).pipe(Effect.provide(layer)), {
				interactive: false,
			});
			const result = yield* Fiber.join(fiber);
			expect(calls).toEqual([undefined]);
			expect(yield* session.mounts).toBe(0);
			expect(result.stdout).toEqual(["✓ dirty-spec: restored to abc111\n↷ clean-spec: clean — skipped"]);
			expect(result.exitCode).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("with names restores exactly those, unasked", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(runReposRestore("/repo", ["foo"]).pipe(Effect.provide(layer)), {
				interactive: false,
			});
			yield* Fiber.join(fiber);
			expect(calls).toEqual([{ root: "/repo", names: ["foo"] }]);
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("a repo STILL dirty after the reset is a finding: reported, exit 1", () =>
		Effect.gen(function* () {
			// The honesty channel: a reset that ran while the tree stayed dirty is
			// not a success, and reporting it as one let a nested-submodule
			// divergence look repaired.
			const { layer } = recording({
				restored: [{ name: "nested-spec", commit: "abc111" }],
				skippedClean: [],
				stillDirty: ["nested-spec"],
			});
			const result = yield* Capture.run(runReposRestore("/repo", ["nested-spec"]).pipe(Effect.provide(layer)));
			expect(result.stdout).toEqual([
				[
					"✓ nested-spec: restored to abc111",
					"✗ nested-spec: reset ran but the worktree is STILL dirty; run `savvy repos status --drift`",
				].join("\n"),
			]);
			expect(result.exitCode).toBe(1);
		}),
	);

	it.effect("says nothing to restore when both result lists are empty", () =>
		Effect.gen(function* () {
			const { layer } = recording({ restored: [], skippedClean: [], stillDirty: [] });
			const result = yield* Capture.run(runReposRestore("/repo", []).pipe(Effect.provide(layer)));
			expect(result.stdout).toEqual(["✓ nothing to restore"]);
			expect(result.exitCode).toBe(0);
		}),
	);

	it.effect("each repos failure is a CommandError with a hint, exit 1", () =>
		Effect.gen(function* () {
			for (const [error, expected] of [
				[ReposStub.notFound("foo"), 'no vendored repo named "foo"'],
				[ReposStub.git("boom"), "boom"],
				[ReposStub.lockdown("chmod failed"), "chmod failed"],
				[ReposStub.configInvalid("manifest is corrupt"), "manifest is corrupt"],
			] as const) {
				const layer = ReposStub.manager({ restore: () => Effect.fail(error) });
				const result = yield* Capture.main(runReposRestore("/repo", ["foo"]).pipe(Effect.provide(layer)));
				expect(result.exitCode).toBe(1);
				expect(result.stdout).toEqual([]);
				expect(result.stderr.join("\n")).toContain("could not restore the vendored repos");
				expect(result.stderr.join("\n")).toContain(expected);
				expect(result.stderr.join("\n")).toContain("TIP:");
			}
		}),
	);

	it.effect("with no manifest it says nothing is vendored and exits 0", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ restore: () => Effect.fail(ReposStub.configMissing) });
			const result = yield* Capture.run(runReposRestore("/repo", []).pipe(Effect.provide(layer)));
			expect(result.stdout).toEqual(["↷ no .repos/config.json — nothing vendored"]);
			expect(result.exitCode).toBe(0);
		}),
	);
});

describe("repos restore — at a terminal", () => {
	it.effect("with no names offers the dirty repos all preselected, then confirms, then restores the picks", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(runReposRestore("/repo", []).pipe(Effect.provide(layer)));
			const picker = yield* session.next({ contains: "Restore which repos?" });
			const frame = yield* picker.plainFrame;
			expect(frame).toContain("foo");
			expect(frame).toContain("baz");
			// Only dirty repos are offered.
			expect(frame).not.toContain("bar");
			// Unselect the first (foo), keep baz.
			yield* picker.press("space", "enter");
			const confirm = yield* session.next({ contains: "Hard-reset baz?" });
			yield* confirm.type("y");
			yield* confirm.press("enter");
			const result = yield* Fiber.join(fiber);
			expect(calls).toEqual([{ root: "/repo", names: ["baz"] }]);
			expect(result.stdout).toEqual(["✓ baz: restored to abc111"]);
		}).pipe(Effect.scoped),
	);

	it.effect("choosing none leaves everything unchanged, exit 0", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(runReposRestore("/repo", []).pipe(Effect.provide(layer)));
			yield* (yield* session.next({ contains: "Restore which repos?" })).press("space", "down", "space", "enter");
			const result = yield* Fiber.join(fiber);
			expect(calls).toEqual([]);
			expect(result.stdout).toEqual(["↷ nothing selected — left unchanged"]);
			expect(result.exitCode).toBe(0);
			expect(yield* session.mounts).toBe(1);
		}).pipe(Effect.scoped),
	);

	it.effect("declining the confirm restores nothing, says so, exit 0", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(runReposRestore("/repo", ["foo"]).pipe(Effect.provide(layer)));
			yield* (yield* session.next({ contains: "Hard-reset foo?" })).press("enter");
			const result = yield* Fiber.join(fiber);
			expect(calls).toEqual([]);
			expect(result.stdout).toEqual(["↷ restore cancelled — nothing changed"]);
			expect(result.exitCode).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("--yes with names restores without mounting anything", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(
				runReposRestore("/repo", ["foo"], { yes: true }).pipe(Effect.provide(layer)),
			);
			yield* Fiber.join(fiber);
			expect(calls).toEqual([{ root: "/repo", names: ["foo"] }]);
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("with nothing dirty there is nothing to ask: the manager reports the clean skips", () =>
		Effect.gen(function* () {
			const calls: Array<ReadonlyArray<string> | undefined> = [];
			const layer = ReposStub.manager({
				status: () => Effect.succeed(ReposStub.status([{ name: "bar" }])),
				restore: (_root, names) => {
					calls.push(names);
					return Effect.succeed({ restored: [], skippedClean: ["bar"], stillDirty: [] });
				},
			});
			const { session, fiber } = yield* Interactive.run(runReposRestore("/repo", []).pipe(Effect.provide(layer)));
			const result = yield* Fiber.join(fiber);
			expect(calls).toEqual([undefined]);
			expect(yield* session.mounts).toBe(0);
			expect(result.stdout).toEqual(["↷ bar: clean — skipped"]);
		}).pipe(Effect.scoped),
	);
});

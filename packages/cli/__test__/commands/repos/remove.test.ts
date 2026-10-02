import { describe, expect, it } from "@effect/vitest";
import type { Repos } from "@savvy-web/silk-effects";
import { Effect, Fiber, Layer } from "effect";

import { runReposRemove } from "../../../src/commands/repos/commands/remove.js";
import { Capture } from "../../utils/capture.js";
import { Interactive } from "../../utils/interactive.js";
import { ReposStub } from "./fixtures.js";

const removeResult: Repos.ReposRemoveResult = {
	name: "foo",
	path: ".repos/foo",
	commitMessage: "chore(repos): remove foo",
	removedNotes: [{ id: "n-1234", date: "2026-01-01", ref: "1.0.0", note: "discovered the entry point" }],
	removedEntry: { url: "https://example.test/foo.git", ref: "1.0.0", purpose: "fixture" },
};

const recording = (result: Repos.ReposRemoveResult = removeResult) => {
	const calls: Array<{ readonly root: string; readonly name: string }> = [];
	const layer = ReposStub.manager({
		status: () => Effect.succeed(ReposStub.status([{ name: "foo" }, { name: "bar" }])),
		remove: (root, name) => {
			calls.push({ root, name });
			return Effect.succeed({ ...result, name });
		},
	});
	return { calls, layer };
};

describe("repos remove", () => {
	it.effect("a run that cannot prompt removes without asking, as it always did", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording({ ...removeResult, removedNotes: [] });
			const { session, fiber } = yield* Interactive.run(runReposRemove("/repo", "foo").pipe(Effect.provide(layer)), {
				interactive: false,
			});
			const result = yield* Fiber.join(fiber);
			expect(calls).toEqual([{ root: "/repo", name: "foo" }]);
			expect(yield* session.mounts).toBe(0);
			expect(result.stdout).toEqual([
				["✓ foo: removed (.repos/foo)", "  staged — review and commit", "    chore(repos): remove foo"].join("\n"),
			]);
		}).pipe(Effect.scoped),
	);

	it.effect("puts lost notes and the orientation JSON in a warning callout, so a re-vendor can pass it back", () =>
		Effect.gen(function* () {
			// Remove-then-re-add is the standing remedy for several vendored-tree
			// problems, and `add` resurrects nothing: the block must be in front of
			// the caller while it still exists.
			const orientation = { layout: "src/ holds the spec", startHere: "src/index.ts" };
			const { layer } = recording({ ...removeResult, removedEntry: { ...removeResult.removedEntry, orientation } });
			const result = yield* Capture.run(runReposRemove("/repo", "foo").pipe(Effect.provide(layer)));
			const out = result.stdout.join("\n");
			expect(out).toContain("WARNING");
			expect(out).toContain("note n-1234 (1.0.0) was removed with the entry — promote it first if it is durable");
			expect(out).toContain("add will NOT restore it");
			// Every line of the JSON survives, so it can be handed back to `add`.
			for (const line of JSON.stringify(orientation, null, 2).split("\n")) {
				expect(out).toContain(line);
			}
		}),
	);

	it.effect("no callout when nothing was lost", () =>
		Effect.gen(function* () {
			const { layer } = recording({ ...removeResult, removedNotes: [] });
			const result = yield* Capture.run(runReposRemove("/repo", "foo").pipe(Effect.provide(layer)));
			expect(result.stdout.join("\n")).not.toContain("WARNING");
		}),
	);

	it.effect("at a terminal it asks, and y removes", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(runReposRemove("/repo", "foo").pipe(Effect.provide(layer)));
			const confirm = yield* session.next({ contains: "Remove foo from .repos/?" });
			yield* confirm.type("y");
			yield* confirm.press("enter");
			yield* Fiber.join(fiber);
			expect(calls).toEqual([{ root: "/repo", name: "foo" }]);
		}).pipe(Effect.scoped),
	);

	it.effect("declining leaves the repo vendored, says so, and exits 0", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(runReposRemove("/repo", "foo").pipe(Effect.provide(layer)));
			yield* (yield* session.next({ contains: "Remove foo from .repos/?" })).press("enter");
			const result = yield* Fiber.join(fiber);
			expect(calls).toEqual([]);
			expect(result.stdout).toEqual(["↷ remove cancelled — foo left vendored"]);
			expect(result.exitCode).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("--yes removes at a terminal without asking", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(
				runReposRemove("/repo", "foo", { yes: true }).pipe(Effect.provide(layer)),
			);
			yield* Fiber.join(fiber);
			expect(calls).toEqual([{ root: "/repo", name: "foo" }]);
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("at a terminal with no name, the repo is picked, then confirmed", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(runReposRemove("/repo", undefined).pipe(Effect.provide(layer)));
			yield* (yield* session.next({ contains: "Unvendor which repo?" })).press("down", "enter");
			const confirm = yield* session.next({ contains: "Remove bar from .repos/?" });
			yield* confirm.type("y");
			yield* confirm.press("enter");
			yield* Fiber.join(fiber);
			expect(calls).toEqual([{ root: "/repo", name: "bar" }]);
		}).pipe(Effect.scoped),
	);

	it.effect("left off at the CLI, a missing name is a usage error, exit 64", () =>
		Effect.gen(function* () {
			const result = yield* ReposStub.cli(["remove"], Layer.merge(ReposStub.manager({}), ReposStub.drift()));
			expect(result.exitCode).toBe(64);
			expect(result.stdout).toEqual([]);
			expect(result.stderr.join("\n")).toContain("Missing required argument: name");
		}),
	);

	it.effect("each repos failure is a CommandError with a hint, exit 1", () =>
		Effect.gen(function* () {
			for (const [error, expected, hint] of [
				[ReposStub.notFound("foo"), 'no vendored repo named "foo"', "savvy repos status"],
				[ReposStub.git("boom"), "boom", "savvy repos status --drift"],
				[ReposStub.lockdown("chmod failed"), "chmod failed", "savvy repos sync"],
				[ReposStub.configInvalid("manifest is corrupt"), "manifest is corrupt", ".repos/config.json"],
			] as const) {
				const layer = ReposStub.manager({ remove: () => Effect.fail(error) });
				const result = yield* Capture.main(runReposRemove("/repo", "foo").pipe(Effect.provide(layer)));
				expect(result.exitCode).toBe(1);
				expect(result.stdout).toEqual([]);
				const stderr = result.stderr.join("\n");
				expect(stderr).toContain("could not remove the repo");
				expect(stderr).toContain(expected);
				expect(stderr).toContain(hint);
			}
		}),
	);

	it.effect("with no manifest it says nothing is vendored and exits 0", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ remove: () => Effect.fail(ReposStub.configMissing) });
			const result = yield* Capture.run(runReposRemove("/repo", "foo").pipe(Effect.provide(layer)));
			expect(result.stdout).toEqual(["↷ no .repos/config.json — nothing vendored"]);
			expect(result.exitCode).toBe(0);
		}),
	);
});

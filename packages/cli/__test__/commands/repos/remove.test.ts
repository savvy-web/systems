import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";

import { runReposRemove } from "../../../src/commands/repos/commands/remove.js";
import { Capture } from "../../utils/capture.js";
import { TestExit } from "../../utils/exit.js";

/** What the last run wrote to stderr: every log line, including a failure's explanation. */
const stderrLines: string[] = [];

const { ReposManager } = Repos;

/** A canned result for a successful remove, carrying one removed note. */
const removeResult: Repos.ReposRemoveResult = {
	name: "foo",
	path: ".repos/foo",
	commitMessage: "chore(repos): remove foo",
	removedNotes: [{ id: "n-1234", date: "2026-01-01", ref: "1.0.0", note: "discovered the entry point" }],
	removedEntry: { url: "https://example.test/foo.git", ref: "1.0.0", purpose: "fixture" },
};

/** Build a stub `Repos.ReposManager` layer whose `remove` resolves/fails as given, recording the args it was called with. */
function makeStubLayer(
	remove: (
		root: string,
		name: string,
	) => Effect.Effect<
		Repos.ReposRemoveResult,
		Repos.ReposConfigError | Repos.GitSubmoduleError | Repos.RepoNotFoundError | Repos.ReposLockdownError
	>,
): Layer.Layer<Repos.ReposManager> {
	return Layer.succeed(ReposManager, {
		status: () => Effect.die("not used in this test"),
		sync: () => Effect.die("not used in this test"),
		add: () => Effect.die("not used in this test"),
		pin: () => Effect.die("not used in this test"),
		note: () => Effect.die("not used in this test"),
		remove,
	} as never);
}

/** Run `runReposRemove` against a stub layer, collecting every `Effect.log` line. */
function collectLogs(cwd: string, name: string, layer: Layer.Layer<Repos.ReposManager>): Effect.Effect<string[]> {
	return Effect.gen(function* () {
		const sink: string[] = [];
		stderrLines.length = 0;
		const captured = Layer.provideMerge(layer, Layer.merge(Capture.layer(sink, stderrLines), Capture.piped));
		yield* runReposRemove(cwd, name).pipe(Effect.provide(captured));
		return sink;
	}).pipe(Effect.provide(TestExit.layer));
}

describe("runReposRemove (adapter)", () => {
	beforeEach(() => {
		TestExit.reset();
	});

	it.effect("prints the removed entry's orientation block, because add will not restore it", () =>
		Effect.gen(function* () {
			// Remove-then-re-add is the standing remedy for several vendored-tree
			// problems, and `add` resurrects nothing. If this block is not put in
			// front of the caller while it still exists, the re-vendor destroys it
			// silently — no report downstream mentions an orientation that is gone.
			const orientation = { layout: "src/ holds the spec", startHere: "src/index.ts" };
			const layer = makeStubLayer(() =>
				Effect.succeed({
					...removeResult,
					removedEntry: { ...removeResult.removedEntry, orientation },
				}),
			);

			const logs = yield* collectLogs("/repo", "foo", layer);

			// The block itself is emitted verbatim (never wrapped), so it can be handed back to `add`.
			expect(logs).toEqual([
				[
					"✓ foo: removed (.repos/foo)",
					"  chore(repos): remove foo",
					"  staged — review and commit",
					"⚠ note n-1234 (1.0.0) was removed with the entry — promote first if durable",
					"⚠ the orientation block for foo was removed with the entry and add will NOT restore it — re-vendoring? capture it now:",
					JSON.stringify(orientation, null, 2),
				].join("\n"),
			]);
		}),
	);

	it.effect("passes cwd and name through to ReposManager.remove", () =>
		Effect.gen(function* () {
			let captured: unknown;
			const layer = makeStubLayer((root, name) => {
				captured = { root, name };
				return Effect.succeed(removeResult);
			});

			yield* collectLogs("/repo", "foo", layer);

			expect(captured).toEqual({ root: "/repo", name: "foo" });
		}),
	);

	it.effect("logs the result, commit message, review cue, and removed-note warnings on success", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(removeResult));

			const logs = yield* collectLogs("/repo", "foo", layer);

			expect(logs).toEqual([
				[
					"✓ foo: removed (.repos/foo)",
					"  chore(repos): remove foo",
					"  staged — review and commit",
					"⚠ note n-1234 (1.0.0) was removed with the entry — promote first if durable",
				].join("\n"),
			]);
			expect(TestExit.code()).toBe(0);
		}),
	);

	it.effect("logs nothing about removed notes when the entry carried none", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed({ ...removeResult, removedNotes: [] }));

			const logs = yield* collectLogs("/repo", "foo", layer);

			expect(logs.some((l) => l.includes("n-1234"))).toBe(false);
			expect(TestExit.code()).toBe(0);
		}),
	);

	it.effect(
		"logs the error and sets exitCode 1 on RepoNotFoundError (removing an unvendored name is a real error)",
		() =>
			Effect.gen(function* () {
				const layer = makeStubLayer(() => Effect.fail(new Repos.RepoNotFoundError({ name: "foo" })));

				const logs = yield* collectLogs("/repo", "foo", layer);
				expect(logs).toEqual([]);

				expect(stderrLines.some((l) => l.includes("no vendored repo named"))).toBe(true);
				expect(TestExit.code()).toBe(1);
			}),
	);

	it.effect("logs the error and sets exitCode 1 on GitSubmoduleError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new Repos.GitSubmoduleError({
						command: "git submodule deinit --force -- .repos/foo",
						cwd: "/repo",
						reason: "boom",
					}),
				),
			);

			const logs = yield* collectLogs("/repo", "foo", layer);
			expect(logs).toEqual([]);

			expect(stderrLines.some((l) => l.includes("boom"))).toBe(true);
			expect(TestExit.code()).toBe(1);
		}),
	);

	it.effect("logs the error and sets exitCode 1 on ReposLockdownError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(new Repos.ReposLockdownError({ path: "/repo/.repos/foo", reason: "chmod failed" })),
			);

			const logs = yield* collectLogs("/repo", "foo", layer);
			expect(logs).toEqual([]);

			expect(stderrLines.some((l) => l.includes("chmod failed"))).toBe(true);
			expect(TestExit.code()).toBe(1);
		}),
	);

	it.effect("logs a friendly no-manifest message and exits 0 on ReposConfigError kind missing", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new Repos.ReposConfigError({ path: "/repo/.repos/config.json", reason: "no such file", kind: "missing" }),
				),
			);

			const logs = yield* collectLogs("/repo", "foo", layer);

			expect(logs).toEqual(["↷ no .repos/config.json — nothing vendored"]);
			expect(TestExit.code()).toBe(0);
		}),
	);

	it.effect("logs the error and sets exitCode 1 on ReposConfigError kind invalid", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new Repos.ReposConfigError({ path: "/repo/.repos/config.json", reason: "invalid JSON", kind: "invalid" }),
				),
			);

			const logs = yield* collectLogs("/repo", "foo", layer);
			expect(logs).toEqual([]);

			expect(stderrLines.some((l) => l.includes("invalid JSON"))).toBe(true);
			expect(TestExit.code()).toBe(1);
		}),
	);
});

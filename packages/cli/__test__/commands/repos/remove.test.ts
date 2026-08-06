import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

import { runReposRemove } from "../../../src/commands/repos/commands/remove.js";

const { ReposManager } = Repos;

/** A canned result for a successful remove, carrying one removed note. */
const removeResult: Repos.ReposRemoveResult = {
	name: "foo",
	path: ".repos/foo",
	commitMessage: "chore(repos): remove foo",
	removedNotes: [{ id: "n-1234", date: "2026-01-01", ref: "1.0.0", note: "discovered the entry point" }],
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
		const captureLogger = Logger.make(({ message }) => {
			sink.push(Array.isArray(message) ? message.join(" ") : String(message));
		});
		const captured = Layer.provideMerge(layer, Logger.layer([captureLogger]));
		yield* runReposRemove(cwd, name).pipe(Effect.provide(captured));
		return sink;
	});
}

describe("runReposRemove (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

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

			expect(logs.some((l) => l.includes("foo") && l.includes("removed") && l.includes(".repos/foo"))).toBe(true);
			expect(logs).toContain("chore(repos): remove foo");
			expect(logs.some((l) => l.includes("staged"))).toBe(true);
			expect(logs.some((l) => l.includes("n-1234") && l.includes("promote"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs nothing about removed notes when the entry carried none", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed({ ...removeResult, removedNotes: [] }));

			const logs = yield* collectLogs("/repo", "foo", layer);

			expect(logs.some((l) => l.includes("n-1234"))).toBe(false);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect(
		"logs the error and sets exitCode 1 on RepoNotFoundError (removing an unvendored name is a real error)",
		() =>
			Effect.gen(function* () {
				const layer = makeStubLayer(() => Effect.fail(new Repos.RepoNotFoundError({ name: "foo" })));

				const logs = yield* collectLogs("/repo", "foo", layer);

				expect(logs.some((l) => l.includes("no vendored repo named"))).toBe(true);
				expect(process.exitCode).toBe(1);
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

			expect(logs.some((l) => l.includes("boom"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("logs the error and sets exitCode 1 on ReposLockdownError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(new Repos.ReposLockdownError({ path: "/repo/.repos/foo", reason: "chmod failed" })),
			);

			const logs = yield* collectLogs("/repo", "foo", layer);

			expect(logs.some((l) => l.includes("chmod failed"))).toBe(true);
			expect(process.exitCode).toBe(1);
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

			expect(logs.some((l) => l.includes("no .repos/config.json — nothing vendored"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
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

			expect(logs.some((l) => l.includes("invalid JSON"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);
});

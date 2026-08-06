import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

import { runReposRestore } from "../../../src/commands/repos/commands/restore.js";

const { ReposManager } = Repos;

/** A canned result for a successful restore. */
const restoreResult: Repos.ReposRestoreResult = {
	restored: [{ name: "foo", commit: "abc111" }],
	skippedClean: [],
};

/** Build a stub `Repos.ReposManager` layer whose `restore` resolves/fails as given, recording the args it was called with. */
function makeStubLayer(
	restore: (
		root: string,
		names?: ReadonlyArray<string>,
	) => Effect.Effect<
		Repos.ReposRestoreResult,
		Repos.ReposConfigError | Repos.GitSubmoduleError | Repos.RepoNotFoundError | Repos.ReposLockdownError
	>,
): Layer.Layer<Repos.ReposManager> {
	return Layer.succeed(ReposManager, {
		status: () => Effect.die("not used in this test"),
		sync: () => Effect.die("not used in this test"),
		add: () => Effect.die("not used in this test"),
		pin: () => Effect.die("not used in this test"),
		note: () => Effect.die("not used in this test"),
		remove: () => Effect.die("not used in this test"),
		rename: () => Effect.die("not used in this test"),
		restore,
	} as never);
}

/** Run `runReposRestore` against a stub layer, collecting every `Effect.log` line. */
function collectLogs(
	cwd: string,
	names: ReadonlyArray<string>,
	layer: Layer.Layer<Repos.ReposManager>,
): Effect.Effect<string[]> {
	return Effect.gen(function* () {
		const sink: string[] = [];
		const captureLogger = Logger.make(({ message }) => {
			sink.push(Array.isArray(message) ? message.join(" ") : String(message));
		});
		const captured = Layer.provideMerge(layer, Logger.layer([captureLogger]));
		yield* runReposRestore(cwd, names).pipe(Effect.provide(captured));
		return sink;
	});
}

describe("runReposRestore (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

	it.effect("passes cwd and explicit names through to ReposManager.restore", () =>
		Effect.gen(function* () {
			let captured: unknown;
			const layer = makeStubLayer((root, names) => {
				captured = { root, names };
				return Effect.succeed(restoreResult);
			});

			yield* collectLogs("/repo", ["foo"], layer);

			expect(captured).toEqual({ root: "/repo", names: ["foo"] });
		}),
	);

	it.effect(
		"passes undefined (not an empty array) when no names are given, so ReposManager restores every dirty repo",
		() =>
			Effect.gen(function* () {
				let captured: unknown;
				const layer = makeStubLayer((root, names) => {
					captured = { root, names };
					return Effect.succeed({ restored: [], skippedClean: [] });
				});

				yield* collectLogs("/repo", [], layer);

				expect(captured).toEqual({ root: "/repo", names: undefined });
			}),
	);

	it.effect("logs each restored repo and its commit on success", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.succeed({
					restored: [
						{ name: "foo", commit: "abc111" },
						{ name: "bar", commit: "def222" },
					],
					skippedClean: [],
				}),
			);

			const logs = yield* collectLogs("/repo", ["foo", "bar"], layer);

			expect(logs.some((l) => l.includes("foo") && l.includes("restored") && l.includes("abc111"))).toBe(true);
			expect(logs.some((l) => l.includes("bar") && l.includes("restored") && l.includes("def222"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs skipped-clean repos in the names-omitted form", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.succeed({
					restored: [{ name: "dirty-spec", commit: "abc111" }],
					skippedClean: ["clean-spec"],
				}),
			);

			const logs = yield* collectLogs("/repo", [], layer);

			expect(logs.some((l) => l.includes("dirty-spec") && l.includes("restored"))).toBe(true);
			expect(logs.some((l) => l.includes("clean-spec") && l.includes("clean"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs a nothing-to-restore message when both result arrays are empty", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed({ restored: [], skippedClean: [] }));

			const logs = yield* collectLogs("/repo", [], layer);

			expect(logs.some((l) => l.includes("nothing to restore"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect(
		"logs the error and sets exitCode 1 on RepoNotFoundError (restoring an unvendored name is a real error)",
		() =>
			Effect.gen(function* () {
				const layer = makeStubLayer(() => Effect.fail(new Repos.RepoNotFoundError({ name: "foo" })));

				const logs = yield* collectLogs("/repo", ["foo"], layer);

				expect(logs.some((l) => l.includes("no vendored repo named"))).toBe(true);
				expect(process.exitCode).toBe(1);
			}),
	);

	it.effect("logs the error and sets exitCode 1 on GitSubmoduleError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new Repos.GitSubmoduleError({ command: "git reset --hard abc111", cwd: "/repo/.repos/foo", reason: "boom" }),
				),
			);

			const logs = yield* collectLogs("/repo", ["foo"], layer);

			expect(logs.some((l) => l.includes("boom"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("logs the error and sets exitCode 1 on ReposLockdownError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(new Repos.ReposLockdownError({ path: "/repo/.repos/foo", reason: "chmod failed" })),
			);

			const logs = yield* collectLogs("/repo", ["foo"], layer);

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

			const logs = yield* collectLogs("/repo", [], layer);

			expect(logs.some((l) => l.includes("no .repos/config.json — nothing vendored"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs the error and sets exitCode 1 on ReposConfigError kind invalid", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new Repos.ReposConfigError({
						path: "/repo/.repos/config.json",
						reason: "manifest is corrupt",
						kind: "invalid",
					}),
				),
			);

			const logs = yield* collectLogs("/repo", [], layer);

			expect(logs.some((l) => l.includes("manifest is corrupt"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);
});

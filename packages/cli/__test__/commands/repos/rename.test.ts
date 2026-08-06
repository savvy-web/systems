import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

import { runReposRename } from "../../../src/commands/repos/commands/rename.js";

const { ReposManager } = Repos;

/** A canned result for a successful rename. */
const renameResult: Repos.ReposRenameResult = {
	oldName: "foo",
	newName: "bar",
	path: ".repos/bar",
	commitMessage: "chore(repos): rename foo to bar",
};

/** Build a stub `Repos.ReposManager` layer whose `rename` resolves/fails as given, recording the args it was called with. */
function makeStubLayer(
	rename: (
		root: string,
		oldName: string,
		newName: string,
	) => Effect.Effect<
		Repos.ReposRenameResult,
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
		rename,
	} as never);
}

/** Run `runReposRename` against a stub layer, collecting every `Effect.log` line. */
function collectLogs(
	cwd: string,
	oldName: string,
	newName: string,
	layer: Layer.Layer<Repos.ReposManager>,
): Effect.Effect<string[]> {
	return Effect.gen(function* () {
		const sink: string[] = [];
		const captureLogger = Logger.make(({ message }) => {
			sink.push(Array.isArray(message) ? message.join(" ") : String(message));
		});
		const captured = Layer.provideMerge(layer, Logger.layer([captureLogger]));
		yield* runReposRename(cwd, oldName, newName).pipe(Effect.provide(captured));
		return sink;
	});
}

describe("runReposRename (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

	it.effect("passes cwd, oldName, and newName through to ReposManager.rename", () =>
		Effect.gen(function* () {
			let captured: unknown;
			const layer = makeStubLayer((root, oldName, newName) => {
				captured = { root, oldName, newName };
				return Effect.succeed(renameResult);
			});

			yield* collectLogs("/repo", "foo", "bar", layer);

			expect(captured).toEqual({ root: "/repo", oldName: "foo", newName: "bar" });
		}),
	);

	it.effect("logs the result, commit message, and review cue on success", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(renameResult));

			const logs = yield* collectLogs("/repo", "foo", "bar", layer);

			expect(logs.some((l) => l.includes("foo") && l.includes("renamed") && l.includes("bar"))).toBe(true);
			expect(logs).toContain("chore(repos): rename foo to bar");
			expect(logs.some((l) => l.includes("staged"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect(
		"logs the error and sets exitCode 1 on RepoNotFoundError (renaming an unvendored name is a real error)",
		() =>
			Effect.gen(function* () {
				const layer = makeStubLayer(() => Effect.fail(new Repos.RepoNotFoundError({ name: "foo" })));

				const logs = yield* collectLogs("/repo", "foo", "bar", layer);

				expect(logs.some((l) => l.includes("no vendored repo named"))).toBe(true);
				expect(process.exitCode).toBe(1);
			}),
	);

	it.effect("logs the error and sets exitCode 1 on GitSubmoduleError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new Repos.GitSubmoduleError({
						command: "git mv .repos/foo .repos/bar",
						cwd: "/repo",
						reason: "boom",
					}),
				),
			);

			const logs = yield* collectLogs("/repo", "foo", "bar", layer);

			expect(logs.some((l) => l.includes("boom"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("logs the error and sets exitCode 1 on ReposLockdownError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(new Repos.ReposLockdownError({ path: "/repo/.repos/foo", reason: "chmod failed" })),
			);

			const logs = yield* collectLogs("/repo", "foo", "bar", layer);

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

			const logs = yield* collectLogs("/repo", "foo", "bar", layer);

			expect(logs.some((l) => l.includes("no .repos/config.json — nothing vendored"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs the error and sets exitCode 1 on ReposConfigError kind invalid (e.g. newName already vendored)", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new Repos.ReposConfigError({
						path: "/repo/.repos/config.json",
						reason: `"bar" is already vendored — choose a different name`,
						kind: "invalid",
					}),
				),
			);

			const logs = yield* collectLogs("/repo", "foo", "bar", layer);

			expect(logs.some((l) => l.includes("already vendored"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);
});

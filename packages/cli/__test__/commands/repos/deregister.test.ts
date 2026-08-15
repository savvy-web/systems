import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

import { runReposDeregister } from "../../../src/commands/repos/commands/deregister.js";

const { ReposManager, ReposConfigError, GitSubmoduleError } = Repos;

/** Build a stub `Repos.ReposManager` layer whose `deregister` resolves/fails as given. */
function makeStubLayer(
	deregister: (
		root: string,
		section: string,
	) => Effect.Effect<Repos.ReposDeregisterResult, Repos.ReposConfigError | Repos.GitSubmoduleError>,
): Layer.Layer<Repos.ReposManager> {
	return Layer.succeed(ReposManager, {
		status: () => Effect.die("not used in this test"),
		sync: () => Effect.die("not used in this test"),
		add: () => Effect.die("not used in this test"),
		pin: () => Effect.die("not used in this test"),
		note: () => Effect.die("not used in this test"),
		deregister,
	} as never);
}

/**
 * Run `runReposDeregister` against a stub layer, collecting every
 * `Effect.log` line. The handler `catchTag`s `ReposConfigError`/
 * `GitSubmoduleError` (every failure is real — `exitCode = 1`), so the
 * returned effect never fails.
 */
function collectLogs(cwd: string, section: string, layer: Layer.Layer<Repos.ReposManager>): Effect.Effect<string[]> {
	return Effect.gen(function* () {
		const sink: string[] = [];
		const captureLogger = Logger.make(({ message }) => {
			sink.push(Array.isArray(message) ? message.join(" ") : String(message));
		});
		const captured = Layer.provideMerge(layer, Logger.layer([captureLogger]));
		yield* runReposDeregister(cwd, section).pipe(Effect.provide(captured));
		return sink;
	});
}

describe("runReposDeregister (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

	it.effect("logs the removed keys and the nothing-to-commit posture, exit undefined", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer((_root, section) =>
				Effect.succeed({
					section,
					removedKeys: [`submodule.${section}.url`, `submodule.${section}.active`],
				}),
			);

			const logs = yield* collectLogs("/repo", ".repos/old", layer);

			expect(logs.some((l) => l.includes(".repos/old: deregistered (2 config keys removed)"))).toBe(true);
			expect(logs.some((l) => l.includes("removed submodule..repos/old.url"))).toBe(true);
			expect(logs.some((l) => l.includes("removed submodule..repos/old.active"))).toBe(true);
			expect(logs.some((l) => l.includes("nothing to commit"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs the refusal and sets exitCode 1 on ReposConfigError (live manifest entry)", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new ReposConfigError({
						path: ".repos/config.json",
						reason: '".repos/spec" is the canonical registration of manifest entry "spec"',
						kind: "invalid",
					}),
				),
			);

			const logs = yield* collectLogs("/repo", ".repos/spec", layer);

			expect(logs.some((l) => l.includes("canonical registration"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("logs the error message and sets exitCode 1 on GitSubmoduleError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new GitSubmoduleError({
						command: "git config --remove-section submodule..repos/old",
						cwd: "/repo",
						reason: "fatal: no such section",
					}),
				),
			);

			const logs = yield* collectLogs("/repo", ".repos/old", layer);

			expect(logs.some((l) => l.includes("git command failed in /repo") && l.includes("no such section"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);
});

import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runReposSync } from "../../../src/commands/repos/commands/sync.js";

const { ReposManager, ReposConfigError, GitSubmoduleError } = Repos;

/** A canned report with one entry in each of the three actionable buckets. */
const activeReport: Repos.ReposSyncReport = {
	clearedLocks: ["foo"],
	initialized: ["bar"],
	sparseApplied: ["baz"],
	upToDate: [],
};

/** A canned report where nothing needed reconciling. */
const emptyReport: Repos.ReposSyncReport = {
	clearedLocks: [],
	initialized: [],
	sparseApplied: [],
	upToDate: ["foo"],
};

/** Build a stub `Repos.ReposManager` layer whose `sync` resolves/fails as given. */
function makeStubLayer(
	sync: (root: string) => Effect.Effect<Repos.ReposSyncReport, Repos.ReposConfigError | Repos.GitSubmoduleError>,
): Layer.Layer<Repos.ReposManager> {
	return Layer.succeed(ReposManager, {
		status: () => Effect.die("not used in this test"),
		sync,
		add: () => Effect.die("not used in this test"),
		pin: () => Effect.die("not used in this test"),
		note: () => Effect.die("not used in this test"),
	} as never);
}

/** Run `runReposSync` against a stub layer, collecting every `Effect.log` line. */
function collectLogs(cwd: string, layer: Layer.Layer<Repos.ReposManager>): Promise<string[]> {
	const sink: string[] = [];
	const captureLogger = Logger.make(({ message }) => {
		sink.push(Array.isArray(message) ? message.join(" ") : String(message));
	});
	const captured = Layer.provideMerge(layer, Logger.layer([captureLogger]));
	return Effect.runPromise(runReposSync(cwd).pipe(Effect.provide(captured))).then(() => sink);
}

describe("runReposSync (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

	it("logs one line per clearedLocks/initialized/sparseApplied entry, exit undefined", async () => {
		const layer = makeStubLayer(() => Effect.succeed(activeReport));

		const logs = await collectLogs("/repo", layer);

		expect(logs.some((l) => l.includes("foo: cleared stale lock"))).toBe(true);
		expect(logs.some((l) => l.includes("bar: initialized"))).toBe(true);
		expect(logs.some((l) => l.includes("baz: sparse-checkout applied"))).toBe(true);
		expect(process.exitCode).toBeUndefined();
	});

	it("logs the up-to-date fallback when all buckets are empty", async () => {
		const layer = makeStubLayer(() => Effect.succeed(emptyReport));

		const logs = await collectLogs("/repo", layer);

		expect(logs.some((l) => l.includes("all vendored repos up to date"))).toBe(true);
		expect(process.exitCode).toBeUndefined();
	});

	it("logs a friendly no-manifest message and exits 0 on ReposConfigError kind missing", async () => {
		const layer = makeStubLayer(() =>
			Effect.fail(new ReposConfigError({ path: "/repo/.repos/config.json", reason: "no such file", kind: "missing" })),
		);

		const logs = await collectLogs("/repo", layer);

		expect(logs.some((l) => l.includes("no .repos/config.json — nothing vendored"))).toBe(true);
		expect(process.exitCode).toBeUndefined();
	});

	it("logs the error and sets exitCode 1 on ReposConfigError kind invalid", async () => {
		const layer = makeStubLayer(() =>
			Effect.fail(new ReposConfigError({ path: "/repo/.repos/config.json", reason: "invalid JSON", kind: "invalid" })),
		);

		const logs = await collectLogs("/repo", layer);

		expect(logs.some((l) => l.includes("invalid JSON"))).toBe(true);
		expect(process.exitCode).toBe(1);
	});

	it("logs the error message and sets exitCode 1 on GitSubmoduleError", async () => {
		const layer = makeStubLayer(() =>
			Effect.fail(
				new GitSubmoduleError({
					command: "git submodule update --init --depth 1 -- .repos/foo",
					cwd: "/repo",
					reason: "fatal: could not fetch",
				}),
			),
		);

		const logs = await collectLogs("/repo", layer);

		expect(logs.some((l) => l.includes("git command failed in /repo") && l.includes("fatal: could not fetch"))).toBe(
			true,
		);
		expect(process.exitCode).toBe(1);
	});
});

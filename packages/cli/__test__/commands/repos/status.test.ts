import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runReposStatus } from "../../../src/commands/repos/commands/status.js";

const { ReposManager, ReposConfigError } = Repos;

/** A clean canned report: one present, non-dirty repo with no stale notes. */
const cleanReport: Repos.ReposStatusReport = {
	repos: [
		{
			name: "foo",
			ref: "v1.0.0",
			purpose: "vendor demo",
			present: true,
			commit: "abc123",
			dirty: false,
			staleNoteIds: [],
		},
	],
	clean: true,
};

/** A dirty canned report: one dirty repo, one missing repo with a stale note. */
const dirtyReport: Repos.ReposStatusReport = {
	repos: [
		{
			name: "foo",
			ref: "v1.0.0",
			purpose: "vendor demo",
			present: true,
			commit: "abc123",
			dirty: true,
			staleNoteIds: [],
		},
		{
			name: "bar",
			ref: "main",
			purpose: "vendor thing",
			present: false,
			commit: null,
			dirty: false,
			staleNoteIds: ["n-1234"],
		},
	],
	clean: false,
};

/** Build a stub `Repos.ReposManager` layer whose `status` resolves/fails as given. */
function makeStubLayer(
	status: (root: string) => Effect.Effect<Repos.ReposStatusReport, Repos.ReposConfigError | Repos.GitSubmoduleError>,
): Layer.Layer<Repos.ReposManager> {
	return Layer.succeed(ReposManager, {
		status,
		sync: () => Effect.die("not used in this test"),
		add: () => Effect.die("not used in this test"),
		pin: () => Effect.die("not used in this test"),
		note: () => Effect.die("not used in this test"),
	} as never);
}

/** Run `runReposStatus` against a stub layer, collecting everything written via `console.log` (the JSON path). */
function collectStdout(cwd: string, json: boolean, layer: Layer.Layer<Repos.ReposManager>): Promise<string> {
	let out = "";
	const original = console.log;
	// biome-ignore lint/suspicious/noExplicitAny: console.log spy for capture
	console.log = ((...args: any[]): void => {
		out += `${args.map((a) => (typeof a === "string" ? a : String(a))).join(" ")}\n`;
	}) as typeof console.log;
	return Effect.runPromise(runReposStatus(cwd, json).pipe(Effect.provide(layer)))
		.then(() => out)
		.finally(() => {
			console.log = original;
		});
}

/** Run `runReposStatus` against a stub layer, collecting every `Effect.log` line (the human-readable path). */
function collectLogs(cwd: string, json: boolean, layer: Layer.Layer<Repos.ReposManager>): Promise<string[]> {
	const sink: string[] = [];
	const captureLogger = Logger.make(({ message }) => {
		sink.push(Array.isArray(message) ? message.join(" ") : String(message));
	});
	const captured = Layer.provideMerge(layer, Logger.replace(Logger.defaultLogger, captureLogger));
	return Effect.runPromise(runReposStatus(cwd, json).pipe(Effect.provide(captured))).then(() => sink);
}

describe("runReposStatus (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

	it("prints parseable JSON of the report with --json", async () => {
		const layer = makeStubLayer(() => Effect.succeed(cleanReport));

		const out = await collectStdout("/repo", true, layer);
		const parsed: Repos.ReposStatusReport = JSON.parse(out);

		expect(parsed).toEqual(cleanReport);
	});

	it("logs one human-readable line per repo with name, ref, and flags", async () => {
		const layer = makeStubLayer(() => Effect.succeed(dirtyReport));

		const logs = await collectLogs("/repo", false, layer);

		expect(logs.some((l) => l.includes("foo @ v1.0.0") && l.includes("dirty"))).toBe(true);
		expect(logs.some((l) => l.includes("bar @ main") && l.includes("missing") && l.includes("1 stale notes"))).toBe(
			true,
		);
	});

	it("sets process.exitCode = 1 when the report is not clean", async () => {
		const layer = makeStubLayer(() => Effect.succeed(dirtyReport));

		await collectLogs("/repo", false, layer);

		expect(process.exitCode).toBe(1);
	});

	it("does not set process.exitCode when the report is clean", async () => {
		const layer = makeStubLayer(() => Effect.succeed(cleanReport));

		await collectLogs("/repo", false, layer);

		expect(process.exitCode).toBeUndefined();
	});

	it("logs a friendly no-manifest message and exits 0 on ReposConfigError", async () => {
		const layer = makeStubLayer(() =>
			Effect.fail(new ReposConfigError({ path: "/repo/.repos/config.json", reason: "no such file" })),
		);

		const logs = await collectLogs("/repo", false, layer);

		expect(logs.some((l) => l.includes("no .repos/config.json — nothing vendored"))).toBe(true);
		expect(process.exitCode).toBeUndefined();
	});
});

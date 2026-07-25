import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

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
function collectStdout(cwd: string, json: boolean, layer: Layer.Layer<Repos.ReposManager>) {
	return Effect.gen(function* () {
		let out = "";
		const original = console.log;
		// biome-ignore lint/suspicious/noExplicitAny: console.log spy for capture
		console.log = ((...args: any[]): void => {
			out += `${args.map((a) => (typeof a === "string" ? a : String(a))).join(" ")}\n`;
		}) as typeof console.log;
		yield* Effect.ensuring(
			runReposStatus(cwd, json).pipe(Effect.provide(layer)),
			Effect.sync(() => {
				console.log = original;
			}),
		);
		return out;
	});
}

/** Run `runReposStatus` against a stub layer, collecting every `Effect.log` line (the human-readable path). */
function collectLogs(cwd: string, json: boolean, layer: Layer.Layer<Repos.ReposManager>) {
	return Effect.gen(function* () {
		const sink: string[] = [];
		const captureLogger = Logger.make(({ message }) => {
			sink.push(Array.isArray(message) ? message.join(" ") : String(message));
		});
		const captured = Layer.provideMerge(layer, Logger.layer([captureLogger]));
		yield* runReposStatus(cwd, json).pipe(Effect.provide(captured));
		return sink;
	});
}

// Tests that go through `collectStdout` use `it.live`: that helper spies on the
// REAL `console.log`, and `it.effect` installs `TestConsole`, which swallows
// Effect's `Console.log` writes before they ever reach the spy. The
// `collectLogs` tests replace the Logger explicitly and are unaffected.
describe("runReposStatus (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

	it.live("prints parseable JSON of the report with --json", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(cleanReport));

			const out = yield* collectStdout("/repo", true, layer);
			const parsed: Repos.ReposStatusReport = JSON.parse(out);

			expect(parsed).toEqual(cleanReport);
		}),
	);

	it.effect("logs one human-readable line per repo with name, ref, and flags", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(dirtyReport));

			const logs = yield* collectLogs("/repo", false, layer);

			expect(logs.some((l) => l.includes("foo @ v1.0.0") && l.includes("dirty"))).toBe(true);
			expect(logs.some((l) => l.includes("bar @ main") && l.includes("missing") && l.includes("1 stale notes"))).toBe(
				true,
			);
		}),
	);

	it.effect("sets process.exitCode = 1 when the report is not clean", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(dirtyReport));

			yield* collectLogs("/repo", false, layer);

			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("does not set process.exitCode when the report is clean", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(cleanReport));

			yield* collectLogs("/repo", false, layer);

			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs a friendly no-manifest message and exits 0 on ReposConfigError kind missing", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new ReposConfigError({ path: "/repo/.repos/config.json", reason: "no such file", kind: "missing" }),
				),
			);

			const logs = yield* collectLogs("/repo", false, layer);

			expect(logs.some((l) => l.includes("no .repos/config.json — nothing vendored"))).toBe(true);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs the error and sets exitCode 1 on ReposConfigError kind invalid", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new ReposConfigError({ path: "/repo/.repos/config.json", reason: "invalid JSON", kind: "invalid" }),
				),
			);

			const logs = yield* collectLogs("/repo", false, layer);

			expect(logs.some((l) => l.includes("invalid JSON"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);

	it.live("prints an empty-but-parseable JSON report and exits 0 on ReposConfigError kind missing with --json", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new ReposConfigError({ path: "/repo/.repos/config.json", reason: "no such file", kind: "missing" }),
				),
			);

			const out = yield* collectStdout("/repo", true, layer);
			const parsed: unknown = JSON.parse(out);

			expect(parsed).toEqual({ repos: [], clean: true });
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("sets exitCode 1 on ReposConfigError kind invalid with --json", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new ReposConfigError({ path: "/repo/.repos/config.json", reason: "invalid JSON", kind: "invalid" }),
				),
			);

			yield* collectLogs("/repo", true, layer);

			expect(process.exitCode).toBe(1);
		}),
	);
});

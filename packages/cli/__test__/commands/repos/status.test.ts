import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

import { runReposStatus } from "../../../src/commands/repos/commands/status.js";
import { Capture } from "../../utils/capture.js";
import { TestExit } from "../../utils/exit.js";

/** What the last run wrote to stderr: every log line, including a failure's explanation. */
const stderrLines: string[] = [];

const { ReposManager, ReposDrift, ReposConfigError } = Repos;

/** A clean canned report: one present, non-dirty repo with no stale notes. */
const cleanReport: Repos.ReposStatusReport = {
	repos: [
		{
			name: "foo",
			ref: "v1.0.0",
			purpose: "vendor demo",
			present: true,
			stagedCommit: "abc123",
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
			stagedCommit: "abc123",
			dirty: true,
			staleNoteIds: [],
		},
		{
			name: "bar",
			ref: "main",
			purpose: "vendor thing",
			present: false,
			dirty: false,
			staleNoteIds: ["n-1234"],
		},
	],
	clean: false,
};

/** A clean canned drift report: no drifts. */
const cleanDriftReport: Repos.ReposDriftReport = { drifts: [], clean: true };

/** A dirty canned drift report: one drift. */
const dirtyDriftReport: Repos.ReposDriftReport = {
	drifts: [
		{
			name: "foo",
			kind: "urlMismatch",
			detail: 'manifest entry "foo" expects url "a" but .gitmodules records "b"',
			manifestValue: "a",
			observedValue: "b",
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

/** Build a stub `Repos.ReposDrift` layer whose `check` resolves/fails as given. */
function makeStubDriftLayer(
	check: (root: string) => Effect.Effect<Repos.ReposDriftReport, Repos.ReposConfigError | Repos.GitSubmoduleError>,
): Layer.Layer<Repos.ReposDrift> {
	return Layer.succeed(ReposDrift, { check } as never);
}

/** Fallback `Repos.ReposDrift` stub for tests that never exercise `--drift`. */
const unusedDriftLayer = makeStubDriftLayer(() => Effect.die("not used in this test"));

/** Run `runReposStatus` against a stub layer, returning everything it printed on stdout (the JSON path). */
function collectStdout(
	cwd: string,
	json: boolean,
	layer: Layer.Layer<Repos.ReposManager>,
	drift = false,
	driftLayer: Layer.Layer<Repos.ReposDrift> = unusedDriftLayer,
) {
	return Effect.gen(function* () {
		const out: string[] = [];
		yield* runReposStatus(cwd, json, drift).pipe(
			Effect.provide(Layer.mergeAll(layer, driftLayer, Capture.layer(out), Capture.piped)),
		);
		return out.join("\n");
	});
}

/** Run `runReposStatus` against a stub layer, collecting every `Effect.log` line (the human-readable path). */
function collectLogs(
	cwd: string,
	json: boolean,
	layer: Layer.Layer<Repos.ReposManager>,
	drift = false,
	driftLayer: Layer.Layer<Repos.ReposDrift> = unusedDriftLayer,
) {
	return Effect.gen(function* () {
		const sink: string[] = [];
		stderrLines.length = 0;
		const captured = Layer.provideMerge(
			Layer.merge(layer, driftLayer),
			Layer.merge(Capture.layer(sink, stderrLines), Capture.piped),
		);
		yield* runReposStatus(cwd, json, drift).pipe(Effect.provide(captured));
		return sink;
	});
}

// Tests that go through `collectStdout` use `it.live`: that helper spies on the
// REAL `console.log`, and `it.effect` installs `TestConsole`, which swallows
// Effect's `Console.log` writes before they ever reach the spy. The
// `collectLogs` tests replace the Logger explicitly and are unaffected.
describe("runReposStatus (adapter)", () => {
	beforeEach(() => {
		TestExit.reset();
	});

	it.live("prints parseable JSON of the report with --json", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(cleanReport));

			const out = yield* collectStdout("/repo", true, layer);
			const parsed: Repos.ReposStatusReport = JSON.parse(out);

			expect(parsed).toEqual(cleanReport);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("logs one human-readable line per repo with name, ref, and flags", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(dirtyReport));

			const logs = yield* collectLogs("/repo", false, layer);

			expect(logs.some((l) => l.includes("foo @ v1.0.0") && l.includes("dirty"))).toBe(true);
			expect(logs.some((l) => l.includes("bar @ main") && l.includes("missing") && l.includes("1 stale notes"))).toBe(
				true,
			);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("sets the exit code = 1 when the report is not clean", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(dirtyReport));

			yield* collectLogs("/repo", false, layer);

			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("does not set the exit code when the report is clean", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(cleanReport));

			yield* collectLogs("/repo", false, layer);

			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
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
			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("logs the error and sets exitCode 1 on ReposConfigError kind invalid", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new ReposConfigError({ path: "/repo/.repos/config.json", reason: "invalid JSON", kind: "invalid" }),
				),
			);

			const logs = yield* collectLogs("/repo", false, layer);
			expect(logs).toEqual([]);

			expect(stderrLines.some((l) => l.includes("invalid JSON"))).toBe(true);
			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
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
			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	// The drift monitor JSON.parses this command's stdout, so no failure path may
	// put a plain line there — not even under a logger that prints info to stdout.
	it.effect("--json keeps stdout one JSON document on the config-error path, the message on stderr", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new ReposConfigError({ path: "/repo/.repos/config.json", reason: "invalid JSON", kind: "invalid" }),
				),
			);
			const result = yield* Capture.run(
				runReposStatus("/repo", true).pipe(
					Effect.provide(Layer.merge(layer, unusedDriftLayer)),
					Effect.provide(Capture.piped),
				),
			);
			const parsed = JSON.parse(result.stdout.join("\n")) as { readonly error: string; readonly clean: boolean };
			expect(parsed.clean).toBe(false);
			expect(parsed.error).toContain("invalid JSON");
			expect(result.stderr.join("\n")).toContain("invalid JSON");
			expect(result.exitCode).toBe(1);
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

			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("--drift logs one line per drift and sets exitCode 1 when drifts exist", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(cleanReport));
			const driftLayer = makeStubDriftLayer(() => Effect.succeed(dirtyDriftReport));

			const logs = yield* collectLogs("/repo", false, layer, true, driftLayer);

			expect(logs.some((l) => l.includes("foo: urlMismatch — ") && l.includes('expects url "a"'))).toBe(true);
			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("--drift prints no drift lines and does not set exitCode when the drift report is clean", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(cleanReport));
			const driftLayer = makeStubDriftLayer(() => Effect.succeed(cleanDriftReport));

			const logs = yield* collectLogs("/repo", false, layer, true, driftLayer);

			expect(logs.some((l) => l.includes(":"))).toBe(false);
			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.live("--json --drift merges { drift } into the JSON payload", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(cleanReport));
			const driftLayer = makeStubDriftLayer(() => Effect.succeed(dirtyDriftReport));

			const out = yield* collectStdout("/repo", true, layer, true, driftLayer);
			const parsed: unknown = JSON.parse(out);

			expect(parsed).toEqual({ ...cleanReport, drift: dirtyDriftReport });
			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("--drift stays friendly-exit-0 when the manifest is missing", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() =>
				Effect.fail(
					new ReposConfigError({ path: "/repo/.repos/config.json", reason: "no such file", kind: "missing" }),
				),
			);
			const driftLayer = makeStubDriftLayer(() => Effect.die("not used: status fails before drift check runs"));

			const logs = yield* collectLogs("/repo", false, layer, true, driftLayer);

			expect(logs.some((l) => l.includes("no .repos/config.json — nothing vendored"))).toBe(true);
			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);
});

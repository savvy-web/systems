import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

import { runReposNote } from "../../../src/commands/repos/commands/note.js";

const { ReposManager, NoteNotFoundError } = Repos;

/** A canned result for a successful note mutation. */
const addResult: Repos.ReposNoteResult = {
	name: "foo",
	op: "add",
	id: "n-1234",
	noteCount: 1,
};

/** A canned result for a successful promote mutation. */
const promoteResult: Repos.ReposNoteResult = {
	name: "foo",
	op: "promote",
	id: "n-5678",
	noteCount: 0,
};

/** Build a stub `Repos.ReposManager` layer whose `note` resolves/fails as given, recording the args it was called with. */
function makeStubLayer(
	note: (
		root: string,
		name: string,
		op: Parameters<Repos.ReposManagerShape["note"]>[2],
	) => Effect.Effect<Repos.ReposNoteResult, Repos.ReposConfigError | Repos.RepoNotFoundError | Repos.NoteNotFoundError>,
): Layer.Layer<Repos.ReposManager> {
	return Layer.succeed(ReposManager, {
		status: () => Effect.die("not used in this test"),
		sync: () => Effect.die("not used in this test"),
		add: () => Effect.die("not used in this test"),
		pin: () => Effect.die("not used in this test"),
		note,
	} as never);
}

/** Run `runReposNote` against a stub layer, collecting every `Effect.log` line. */
function collectLogs(
	cwd: string,
	name: string,
	op: Parameters<Repos.ReposManagerShape["note"]>[2],
	layer: Layer.Layer<Repos.ReposManager>,
): Effect.Effect<string[]> {
	return Effect.gen(function* () {
		const sink: string[] = [];
		const captureLogger = Logger.make(({ message }) => {
			sink.push(Array.isArray(message) ? message.join(" ") : String(message));
		});
		const captured = Layer.provideMerge(layer, Logger.layer([captureLogger]));
		yield* runReposNote(cwd, name, op).pipe(Effect.provide(captured));
		return sink;
	});
}

describe("runReposNote (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

	it.effect("passes {op: 'add', note} through to ReposManager.note", () =>
		Effect.gen(function* () {
			let captured: unknown;
			const layer = makeStubLayer((root, name, op) => {
				captured = { root, name, op };
				return Effect.succeed(addResult);
			});

			yield* collectLogs("/repo", "foo", { op: "add", note: "discovered the entry point" }, layer);

			expect(captured).toEqual({
				root: "/repo",
				name: "foo",
				op: { op: "add", note: "discovered the entry point" },
			});
		}),
	);

	it.effect("passes {op: 'promote', id, into: 'startHere'} through to ReposManager.note", () =>
		Effect.gen(function* () {
			let captured: unknown;
			const layer = makeStubLayer((root, name, op) => {
				captured = { root, name, op };
				return Effect.succeed(promoteResult);
			});

			yield* collectLogs("/repo", "foo", { op: "promote", id: "n-5678", into: "startHere" }, layer);

			expect(captured).toEqual({
				root: "/repo",
				name: "foo",
				op: { op: "promote", id: "n-5678", into: "startHere" },
			});
		}),
	);

	it.effect("logs the ReposNoteResult on success", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.succeed(addResult));

			const logs = yield* collectLogs("/repo", "foo", { op: "add", note: "discovered the entry point" }, layer);

			expect(logs.some((l) => l.includes("foo") && l.includes("add") && l.includes("n-1234") && l.includes("1"))).toBe(
				true,
			);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs the error and sets exitCode 1 on RepoNotFoundError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.fail(new Repos.RepoNotFoundError({ name: "foo" })));

			const logs = yield* collectLogs("/repo", "foo", { op: "add", note: "x" }, layer);

			expect(logs.some((l) => l.includes("no vendored repo named"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("logs the error and sets exitCode 1 on NoteNotFoundError", () =>
		Effect.gen(function* () {
			const layer = makeStubLayer(() => Effect.fail(new NoteNotFoundError({ name: "foo", id: "n-9999" })));

			const logs = yield* collectLogs("/repo", "foo", { op: "remove", id: "n-9999" }, layer);

			expect(logs.some((l) => l.includes('no note "n-9999" on vendored repo "foo"'))).toBe(true);
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

			const logs = yield* collectLogs("/repo", "foo", { op: "add", note: "x" }, layer);

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

			const logs = yield* collectLogs("/repo", "foo", { op: "add", note: "x" }, layer);

			expect(logs.some((l) => l.includes("invalid JSON"))).toBe(true);
			expect(process.exitCode).toBe(1);
		}),
	);
});

import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
): Promise<string[]> {
	const sink: string[] = [];
	const captureLogger = Logger.make(({ message }) => {
		sink.push(Array.isArray(message) ? message.join(" ") : String(message));
	});
	const captured = Layer.provideMerge(layer, Logger.layer([captureLogger]));
	return Effect.runPromise(runReposNote(cwd, name, op).pipe(Effect.provide(captured))).then(() => sink);
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

	it("passes {op: 'add', note} through to ReposManager.note", async () => {
		let captured: unknown;
		const layer = makeStubLayer((root, name, op) => {
			captured = { root, name, op };
			return Effect.succeed(addResult);
		});

		await collectLogs("/repo", "foo", { op: "add", note: "discovered the entry point" }, layer);

		expect(captured).toEqual({
			root: "/repo",
			name: "foo",
			op: { op: "add", note: "discovered the entry point" },
		});
	});

	it("passes {op: 'promote', id, into: 'startHere'} through to ReposManager.note", async () => {
		let captured: unknown;
		const layer = makeStubLayer((root, name, op) => {
			captured = { root, name, op };
			return Effect.succeed(promoteResult);
		});

		await collectLogs("/repo", "foo", { op: "promote", id: "n-5678", into: "startHere" }, layer);

		expect(captured).toEqual({
			root: "/repo",
			name: "foo",
			op: { op: "promote", id: "n-5678", into: "startHere" },
		});
	});

	it("logs the ReposNoteResult on success", async () => {
		const layer = makeStubLayer(() => Effect.succeed(addResult));

		const logs = await collectLogs("/repo", "foo", { op: "add", note: "discovered the entry point" }, layer);

		expect(logs.some((l) => l.includes("foo") && l.includes("add") && l.includes("n-1234") && l.includes("1"))).toBe(
			true,
		);
		expect(process.exitCode).toBeUndefined();
	});

	it("logs the error and sets exitCode 1 on RepoNotFoundError", async () => {
		const layer = makeStubLayer(() => Effect.fail(new Repos.RepoNotFoundError({ name: "foo" })));

		const logs = await collectLogs("/repo", "foo", { op: "add", note: "x" }, layer);

		expect(logs.some((l) => l.includes("no vendored repo named"))).toBe(true);
		expect(process.exitCode).toBe(1);
	});

	it("logs the error and sets exitCode 1 on NoteNotFoundError", async () => {
		const layer = makeStubLayer(() => Effect.fail(new NoteNotFoundError({ name: "foo", id: "n-9999" })));

		const logs = await collectLogs("/repo", "foo", { op: "remove", id: "n-9999" }, layer);

		expect(logs.some((l) => l.includes('no note "n-9999" on vendored repo "foo"'))).toBe(true);
		expect(process.exitCode).toBe(1);
	});

	it("logs a friendly no-manifest message and exits 0 on ReposConfigError kind missing", async () => {
		const layer = makeStubLayer(() =>
			Effect.fail(
				new Repos.ReposConfigError({ path: "/repo/.repos/config.json", reason: "no such file", kind: "missing" }),
			),
		);

		const logs = await collectLogs("/repo", "foo", { op: "add", note: "x" }, layer);

		expect(logs.some((l) => l.includes("no .repos/config.json — nothing vendored"))).toBe(true);
		expect(process.exitCode).toBeUndefined();
	});

	it("logs the error and sets exitCode 1 on ReposConfigError kind invalid", async () => {
		const layer = makeStubLayer(() =>
			Effect.fail(
				new Repos.ReposConfigError({ path: "/repo/.repos/config.json", reason: "invalid JSON", kind: "invalid" }),
			),
		);

		const logs = await collectLogs("/repo", "foo", { op: "add", note: "x" }, layer);

		expect(logs.some((l) => l.includes("invalid JSON"))).toBe(true);
		expect(process.exitCode).toBe(1);
	});
});

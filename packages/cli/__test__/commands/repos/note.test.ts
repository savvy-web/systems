import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { CliAudience } from "@effected/cli";
import { TestTerminal } from "@effected/cli/testing";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Fiber, Layer } from "effect";
import { Command } from "effect/cli";

import type { ReposNoteRequest } from "../../../src/commands/repos/commands/note.js";
import { runReposNote } from "../../../src/commands/repos/commands/note.js";
import { reposCommand } from "../../../src/commands/repos/index.js";
import { Capture } from "../../utils/capture.js";
import { Interactive } from "../../utils/interactive.js";
import { ReposStub } from "./fixtures.js";

type NoteOp = Parameters<Repos.ReposManagerShape["note"]>[2];

const recording = () => {
	const calls: Array<{ readonly name: string; readonly op: NoteOp }> = [];
	const layer = ReposStub.manager({
		status: () => Effect.succeed(ReposStub.status([{ name: "foo" }, { name: "bar" }])),
		note: (_root, name, op) => {
			calls.push({ name, op });
			return Effect.succeed({ name, op: op.op, id: "n-1234", noteCount: 1 });
		},
	});
	return { calls, layer };
};

const run = (name: string | undefined, request: ReposNoteRequest, layer: Layer.Layer<Repos.ReposManager>) =>
	runReposNote("/repo", name, request).pipe(Effect.provide(layer));

describe("repos note", () => {
	it.effect("passes add and promote through and prints the result", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const added = yield* Capture.run(run("foo", { op: "add", note: "entry point is src/index.ts" }, layer));
			yield* Capture.run(run("foo", { op: "promote", id: "n-5678", into: "startHere" }, layer));
			expect(calls).toEqual([
				{ name: "foo", op: { op: "add", note: "entry point is src/index.ts" } },
				{ name: "foo", op: { op: "promote", id: "n-5678", into: "startHere" } },
			]);
			expect(added.stdout).toEqual(["✓ foo: add note n-1234 (1 notes)"]);
		}),
	);

	it.effect("a run that cannot prompt fails a missing name or text as a usage error, reading nothing", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({});
			for (const [name, expected] of [
				[undefined, "savvy repos note add: name"],
				["foo", "savvy repos note add: text"],
			] as const) {
				const exit = yield* Effect.exit(Capture.run(run(name, { op: "add" }, layer)));
				expect(ReposStub.missingArgument(exit)).toBe(expected);
			}
		}),
	);

	it.effect("left off at the CLI, a missing name, text, id or --into is a usage error, exit 64", () =>
		Effect.gen(function* () {
			const services = Layer.merge(ReposStub.manager({}), ReposStub.drift());
			for (const [argv, expected] of [
				[["note", "add"], "Missing required argument: name"],
				[["note", "add", "foo"], "Missing required argument: text"],
				[["note", "remove", "foo"], "Missing required argument: id"],
				[["note", "promote", "foo", "n-1"], "--into"],
			] as const) {
				const result = yield* ReposStub.cli(argv, services);
				expect(result.exitCode).toBe(64);
				// Every usage error, the parser's or a handler's, prints the error and the
				// subcommand's help on stderr and leaves stdout empty.
				expect(result.stdout).toEqual([]);
				expect(result.stderr.join("\n")).toContain(expected);
				expect(result.stderr.join("\n")).toContain("USAGE\n  savvy repos note");
			}
		}),
	);

	it.effect("at a terminal, the repo is picked and the note typed", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(run(undefined, { op: "add" }, layer));
			yield* (yield* session.next({ contains: "Which repo's notes (add)?" })).press("down", "enter");
			const input = yield* session.next({ contains: "Note to add to bar:" });
			yield* input.type("look in lib/");
			yield* input.press("enter");
			yield* Fiber.join(fiber);
			expect(calls).toEqual([{ name: "bar", op: { op: "add", note: "look in lib/" } }]);
		}).pipe(Effect.scoped),
	);

	it.effect("at a terminal, a missing promote --into is picked while parsing", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const terminal = yield* TestTerminal.make();
			const root = Command.make("savvy").pipe(
				Command.withSharedFlags(CliAudience.flags()),
				Command.withSubcommands([reposCommand]),
			);
			const { session, fiber } = yield* Interactive.run(
				Command.runWith(root, { version: "0.0.0" })(["repos", "note", "promote", "foo", "n-1"]).pipe(
					Effect.provide(Layer.mergeAll(layer, ReposStub.drift(), terminal.layer)),
					Effect.provide(NodeServices.layer),
				),
			);
			yield* (yield* session.next({ contains: "Promote the note into which orientation field?" })).press(
				"down",
				"enter",
			);
			yield* Fiber.join(fiber);
			expect(calls).toEqual([{ name: "foo", op: { op: "promote", id: "n-1", into: "startHere" } }]);
		}).pipe(Effect.scoped),
	);

	it.effect("an unknown note or repo fails as a CommandError with a hint, exit 1", () =>
		Effect.gen(function* () {
			for (const [error, expected] of [
				[new Repos.NoteNotFoundError({ name: "foo", id: "n-9999" }), 'no note "n-9999"'],
				[ReposStub.notFound("foo"), 'no vendored repo named "foo"'],
				[ReposStub.configInvalid("manifest is corrupt"), "manifest is corrupt"],
			] as const) {
				const layer = ReposStub.manager({ note: () => Effect.fail(error) });
				const result = yield* Capture.main(run("foo", { op: "remove", id: "n-9999" }, layer));
				expect(result.exitCode).toBe(1);
				expect(result.stdout).toEqual([]);
				expect(result.stderr.join("\n")).toContain("could not remove the note");
				expect(result.stderr.join("\n")).toContain(expected);
				expect(result.stderr.join("\n")).toContain("TIP:");
			}
		}),
	);

	it.effect("with no manifest it says nothing is vendored and exits 0", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ note: () => Effect.fail(ReposStub.configMissing) });
			const result = yield* Capture.run(run("foo", { op: "add", note: "x" }, layer));
			expect(result.stdout).toEqual(["↷ no .repos/config.json — nothing vendored"]);
			expect(result.exitCode).toBe(0);
		}),
	);
});

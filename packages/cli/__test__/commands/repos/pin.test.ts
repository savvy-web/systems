import { describe, expect, it } from "@effect/vitest";
import type { Repos } from "@savvy-web/silk-effects";
import { Effect, Fiber, Layer } from "effect";

import { runReposPin } from "../../../src/commands/repos/commands/pin.js";
import { Capture } from "../../utils/capture.js";
import { Interactive } from "../../utils/interactive.js";
import { ReposStub } from "./fixtures.js";

const pinResult: Repos.ReposPinResult = {
	name: "foo",
	ref: "v2",
	oldCommit: "abc111",
	newCommit: "def222",
	commitMessage: "chore(repos): pin foo to v2",
	staleNoteIds: [],
};

/** A manager that lists `foo` and `bar` and records every pin. */
const recording = () => {
	const calls: Array<{ readonly name: string; readonly ref: string }> = [];
	const layer = ReposStub.manager({
		status: () =>
			Effect.succeed(
				ReposStub.status([
					{ name: "foo", ref: "v1" },
					{ name: "bar", ref: "main" },
				]),
			),
		pin: (_root, name, ref) => {
			calls.push({ name, ref });
			return Effect.succeed({ ...pinResult, name });
		},
	});
	return { calls, layer };
};

describe("repos pin", () => {
	it.effect("pins the named repo and prints the commit message as a code block", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const result = yield* Capture.run(runReposPin("/repo", "foo", "v2").pipe(Effect.provide(layer)));
			expect(calls).toEqual([{ name: "foo", ref: "v2" }]);
			expect(result.stdout).toEqual([
				["✓ foo: abc111 -> def222", "  staged — review and commit", "    chore(repos): pin foo to v2"].join("\n"),
			]);
			expect(result.exitCode).toBe(0);
		}),
	);

	it.effect("a run that cannot prompt never reads the manifest or mounts a picker for a missing name", () =>
		Effect.gen(function* () {
			// `status` dies in this stub: reading it would fail the test.
			const layer = ReposStub.manager({});
			const { session, fiber } = yield* Interactive.run(
				runReposPin("/repo", undefined, undefined).pipe(Effect.provide(layer)),
				{
					interactive: false,
				},
			);
			const exit = yield* Fiber.await(fiber);
			expect(exit._tag).toBe("Failure");
			expect(ReposStub.missingArgument(exit)).toBe("savvy repos pin: name");
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("left off at the CLI, a missing name or ref is a usage error, exit 64", () =>
		Effect.gen(function* () {
			const services = Layer.merge(ReposStub.manager({}), ReposStub.drift());
			const noName = yield* ReposStub.cli(["pin"], services);
			expect(noName.exitCode).toBe(64);
			expect(noName.stdout).toEqual([]);
			expect(noName.stderr.join("\n")).toContain("Missing required argument: name");
			// The handler's usage error carries the subcommand's help, like a parse error.
			expect(noName.stderr.join("\n")).toContain("USAGE\n  savvy repos pin");

			const noRef = yield* ReposStub.cli(["pin", "foo"], services);
			expect(noRef.exitCode).toBe(64);
			expect(noRef.stderr.join("\n")).toContain("Missing required argument: ref");
		}),
	);

	it.effect("at a terminal, a missing name is picked from the vendored repos and the ref typed", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(
				runReposPin("/repo", undefined, undefined).pipe(Effect.provide(layer)),
			);
			const picker = yield* session.next({ contains: "Re-pin which repo?" });
			expect(yield* picker.plainFrame).toContain("bar");
			yield* picker.press("down", "enter");
			const ref = yield* session.next({ contains: "Re-pin bar to which ref?" });
			// Starts at the current pin.
			expect(yield* ref.plainFrame).toContain("main");
			yield* ref.press("backspace", "backspace", "backspace", "backspace");
			yield* ref.type("v3");
			yield* ref.press("enter");
			const result = yield* Fiber.join(fiber);
			expect(calls).toEqual([{ name: "bar", ref: "v3" }]);
			expect(result.stdout.join("\n")).toContain("✓ bar: abc111 -> def222");
			expect(yield* session.mounts).toBe(2);
		}).pipe(Effect.scoped),
	);

	it.effect("a repo that is not vendored fails as a CommandError with a hint, exit 1", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ pin: () => Effect.fail(ReposStub.notFound("foo")) });
			const result = yield* Capture.main(runReposPin("/repo", "foo", "v2").pipe(Effect.provide(layer)));
			expect(result.exitCode).toBe(1);
			expect(result.stdout).toEqual([]);
			const stderr = result.stderr.join("\n");
			expect(stderr).toContain("could not re-pin the repo");
			expect(stderr).toContain('no vendored repo named "foo"');
			expect(stderr).toContain("savvy repos status");
		}),
	);

	it.effect("a git failure keeps its lines apart and points at status --drift", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ pin: () => Effect.fail(ReposStub.git("fatal: no such ref")) });
			const result = yield* Capture.main(runReposPin("/repo", "foo", "v2").pipe(Effect.provide(layer)));
			expect(result.exitCode).toBe(1);
			const stderr = result.stderr.join("\n");
			expect(stderr).toContain("  fatal: no such ref");
			expect(stderr).toContain("savvy repos status --drift");
		}),
	);

	it.effect("with no manifest it says nothing is vendored and exits 0", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ pin: () => Effect.fail(ReposStub.configMissing) });
			const result = yield* Capture.run(runReposPin("/repo", "foo", "v2").pipe(Effect.provide(layer)));
			expect(result.stdout).toEqual(["↷ no .repos/config.json — nothing vendored"]);
			expect(result.exitCode).toBe(0);
		}),
	);
});

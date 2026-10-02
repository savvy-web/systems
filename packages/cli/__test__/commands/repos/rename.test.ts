import { describe, expect, it } from "@effect/vitest";
import type { Repos } from "@savvy-web/silk-effects";
import { Effect, Fiber, Layer } from "effect";

import { runReposRename } from "../../../src/commands/repos/commands/rename.js";
import { Capture } from "../../utils/capture.js";
import { Interactive } from "../../utils/interactive.js";
import { ReposStub } from "./fixtures.js";

const renameResult: Repos.ReposRenameResult = {
	oldName: "foo",
	newName: "bar",
	path: ".repos/bar",
	commitMessage: "chore(repos): rename foo to bar",
};

const recording = () => {
	const calls: Array<{ readonly root: string; readonly oldName: string; readonly newName: string }> = [];
	const layer = ReposStub.manager({
		status: () => Effect.succeed(ReposStub.status([{ name: "foo" }, { name: "baz" }])),
		rename: (root, oldName, newName) => {
			calls.push({ root, oldName, newName });
			return Effect.succeed({ ...renameResult, oldName, newName, path: `.repos/${newName}` });
		},
	});
	return { calls, layer };
};

describe("repos rename", () => {
	it.effect("renames, printing the outcome and the commit message as a code block", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const result = yield* Capture.run(runReposRename("/repo", "foo", "bar").pipe(Effect.provide(layer)));
			expect(calls).toEqual([{ root: "/repo", oldName: "foo", newName: "bar" }]);
			expect(result.stdout).toEqual([
				[
					"✓ foo: renamed to bar (.repos/bar)",
					"  staged — review and commit",
					"    chore(repos): rename foo to bar",
				].join("\n"),
			]);
			expect(result.exitCode).toBe(0);
		}),
	);

	it.effect("a run that cannot prompt fails a missing name as a usage error, reading nothing", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(
				runReposRename("/repo", undefined, undefined).pipe(Effect.provide(ReposStub.manager({}))),
				{ interactive: false },
			);
			const exit = yield* Fiber.await(fiber);
			expect(String(exit)).toContain("Missing required argument: old-name");
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("left off at the CLI, a missing old or new name is a usage error, exit 64", () =>
		Effect.gen(function* () {
			const services = Layer.merge(ReposStub.manager({}), ReposStub.drift());
			const none = yield* ReposStub.cli(["rename"], services);
			expect(none.exitCode).toBe(64);
			expect(none.stderr.join("\n")).toContain("Missing required argument: old-name");
			const one = yield* ReposStub.cli(["rename", "foo"], services);
			expect(one.exitCode).toBe(64);
			expect(one.stderr.join("\n")).toContain("Missing required argument: new-name");
			expect(one.stdout).toEqual([]);
		}),
	);

	it.effect("at a terminal, the repo is picked and the new name typed", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(
				runReposRename("/repo", undefined, undefined).pipe(Effect.provide(layer)),
			);
			yield* (yield* session.next({ contains: "Rename which repo?" })).press("down", "enter");
			const input = yield* session.next({ contains: "Rename baz to?" });
			yield* input.type("qux");
			yield* input.press("enter");
			yield* Fiber.join(fiber);
			expect(calls).toEqual([{ root: "/repo", oldName: "baz", newName: "qux" }]);
			expect(yield* session.mounts).toBe(2);
		}).pipe(Effect.scoped),
	);

	it.effect("Esc on the picker is the kit's Cancelled and renames nothing", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(
				runReposRename("/repo", undefined, undefined).pipe(Effect.provide(layer)),
			);
			yield* (yield* session.next({ contains: "Rename which repo?" })).press("escape");
			const exit = yield* Fiber.await(fiber);
			expect(String(exit)).toContain("Cancelled");
			expect(calls).toEqual([]);
		}).pipe(Effect.scoped),
	);

	it.effect("an invalid or taken new name fails as a CommandError with the rename hint, exit 1", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({
				rename: () => Effect.fail(ReposStub.configInvalid('"bar" is already vendored')),
			});
			const result = yield* Capture.main(runReposRename("/repo", "foo", "bar").pipe(Effect.provide(layer)));
			expect(result.exitCode).toBe(1);
			expect(result.stdout).toEqual([]);
			const stderr = result.stderr.join("\n");
			expect(stderr).toContain("could not rename the repo");
			expect(stderr).toContain('"bar" is already vendored');
			expect(stderr).toContain("TIP: the manifest is unreadable, or the new name is invalid or already vendored");
		}),
	);

	it.effect("not-found, git and lockdown failures each fail as a CommandError, exit 1", () =>
		Effect.gen(function* () {
			for (const [error, expected] of [
				[ReposStub.notFound("foo"), 'no vendored repo named "foo"'],
				[ReposStub.git("boom"), "boom"],
				[ReposStub.lockdown("chmod failed"), "chmod failed"],
			] as const) {
				const layer = ReposStub.manager({ rename: () => Effect.fail(error) });
				const result = yield* Capture.main(runReposRename("/repo", "foo", "bar").pipe(Effect.provide(layer)));
				expect(result.exitCode).toBe(1);
				expect(result.stderr.join("\n")).toContain(expected);
				expect(result.stderr.join("\n")).toContain("could not rename the repo");
			}
		}),
	);

	it.effect("with no manifest it says nothing is vendored and exits 0", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ rename: () => Effect.fail(ReposStub.configMissing) });
			const result = yield* Capture.run(runReposRename("/repo", "foo", "bar").pipe(Effect.provide(layer)));
			expect(result.stdout).toEqual(["↷ no .repos/config.json — nothing vendored"]);
			expect(result.exitCode).toBe(0);
		}),
	);
});

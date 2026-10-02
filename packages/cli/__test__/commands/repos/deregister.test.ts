import { describe, expect, it } from "@effect/vitest";
import type { Repos } from "@savvy-web/silk-effects";
import { Effect, Fiber, Layer } from "effect";

import { runReposDeregister } from "../../../src/commands/repos/commands/deregister.js";
import { Capture } from "../../utils/capture.js";
import { Interactive } from "../../utils/interactive.js";
import { ReposStub } from "./fixtures.js";

/** A drift report with one stale registration, one per-entry divergence (not stale), and an unrelated drift. */
const driftReport: Repos.ReposDriftReport = {
	clean: false,
	drifts: [
		{
			name: ".repos/old",
			kind: "localRegistrationDivergence",
			detail: "local git config registers submodule .repos/old, which matches no manifest entry",
			observedValue: ".repos/old",
		},
		{
			name: "spec",
			kind: "localRegistrationDivergence",
			detail: "manifest entry spec is canonically .repos/spec",
			manifestValue: ".repos/spec",
			observedValue: ".repos/spec-old",
		},
		{ name: "foo", kind: "urlMismatch", detail: "url drift", manifestValue: "a", observedValue: "b" },
	],
};

const recording = (report: Repos.ReposDriftReport = driftReport) => {
	const calls: Array<string> = [];
	const layer = Layer.merge(
		ReposStub.manager({
			deregister: (_root, section) => {
				calls.push(section);
				return Effect.succeed({ section, removedKeys: [`submodule.${section}.url`, `submodule.${section}.active`] });
			},
		}),
		ReposStub.drift(() => Effect.succeed(report)),
	);
	return { calls, layer };
};

describe("repos deregister", () => {
	it.effect("prints the removed keys and the nothing-to-commit posture, exit 0", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const result = yield* Capture.run(runReposDeregister("/repo", ".repos/old").pipe(Effect.provide(layer)));
			expect(calls).toEqual([".repos/old"]);
			expect(result.stdout).toEqual([
				[
					"✓ .repos/old: deregistered (2 config keys removed)",
					"  removed submodule..repos/old.url",
					"  removed submodule..repos/old.active",
					"  local git config only — nothing to commit",
				].join("\n"),
			]);
			expect(result.exitCode).toBe(0);
		}),
	);

	it.effect("at a terminal with no section, only the stale registrations are offered", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const { session, fiber } = yield* Interactive.run(
				runReposDeregister("/repo", undefined).pipe(Effect.provide(layer)),
			);
			const picker = yield* session.next({ contains: "Deregister which stale registration?" });
			const frame = yield* picker.plainFrame;
			expect(frame).toContain(".repos/old");
			// A live entry's divergence is not deregister's to clear, nor is a url drift.
			expect(frame).not.toContain("spec");
			expect(frame).not.toContain("foo");
			yield* picker.press("enter");
			yield* Fiber.join(fiber);
			expect(calls).toEqual([".repos/old"]);
		}).pipe(Effect.scoped),
	);

	it.effect("at a terminal with nothing stale, a missing section is still the usage error", () =>
		Effect.gen(function* () {
			const { layer } = recording({ clean: true, drifts: [] });
			const { session, fiber } = yield* Interactive.run(
				runReposDeregister("/repo", undefined).pipe(Effect.provide(layer)),
			);
			const exit = yield* Fiber.await(fiber);
			expect(ReposStub.missingArgument(exit)).toBe("savvy repos deregister: section");
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("a run that cannot prompt never runs the drift check for a missing section", () =>
		Effect.gen(function* () {
			// The drift stub dies if called.
			const layer = Layer.merge(ReposStub.manager({}), ReposStub.drift());
			const { session, fiber } = yield* Interactive.run(
				runReposDeregister("/repo", undefined).pipe(Effect.provide(layer)),
				{
					interactive: false,
				},
			);
			const exit = yield* Fiber.await(fiber);
			expect(ReposStub.missingArgument(exit)).toBe("savvy repos deregister: section");
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("left off at the CLI, a missing section is a usage error, exit 64", () =>
		Effect.gen(function* () {
			const result = yield* ReposStub.cli(["deregister"], Layer.merge(ReposStub.manager({}), ReposStub.drift()));
			expect(result.exitCode).toBe(64);
			expect(result.stdout).toEqual([]);
			expect(result.stderr.join("\n")).toContain("Missing required argument: section");
		}),
	);

	it.effect("refusing a live manifest entry is a CommandError pointing at remove, exit 1", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({
				deregister: () =>
					Effect.fail(ReposStub.configInvalid('".repos/spec" is the canonical registration of manifest entry "spec"')),
			});
			const result = yield* Capture.main(
				runReposDeregister("/repo", ".repos/spec").pipe(Effect.provide(Layer.merge(layer, ReposStub.drift()))),
			);
			expect(result.exitCode).toBe(1);
			expect(result.stdout).toEqual([]);
			const stderr = result.stderr.join("\n");
			expect(stderr).toContain("could not deregister the submodule registration");
			expect(stderr).toContain("canonical registration");
			expect(stderr).toContain("savvy repos remove");
		}),
	);

	it.effect("a git failure is a CommandError whose lines stay apart, exit 1", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ deregister: () => Effect.fail(ReposStub.git("fatal: no such section")) });
			const result = yield* Capture.main(
				runReposDeregister("/repo", ".repos/old").pipe(Effect.provide(Layer.merge(layer, ReposStub.drift()))),
			);
			expect(result.exitCode).toBe(1);
			const stderr = result.stderr.join("\n");
			expect(stderr).toContain("git command failed in /repo");
			expect(stderr).toContain("  fatal: no such section");
		}),
	);
});

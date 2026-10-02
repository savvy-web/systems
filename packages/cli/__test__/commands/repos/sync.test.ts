import { describe, expect, it } from "@effect/vitest";
import type { Repos } from "@savvy-web/silk-effects";
import { Effect, Fiber } from "effect";

import { runReposSync } from "../../../src/commands/repos/commands/sync.js";
import { Capture } from "../../utils/capture.js";
import { Interactive } from "../../utils/interactive.js";
import { ReposStub } from "./fixtures.js";

/** A canned report with one entry in each of the five actionable buckets. */
const activeReport: Repos.ReposSyncReport = {
	clearedLocks: ["foo"],
	initialized: ["bar"],
	sparseApplied: ["baz"],
	upToDate: [],
	urlSynced: ["qux"],
	registered: ["quux"],
	boundaryMarked: [],
};

/** A canned report where nothing needed reconciling. */
const emptyReport: Repos.ReposSyncReport = {
	clearedLocks: [],
	initialized: [],
	sparseApplied: [],
	upToDate: ["foo"],
	urlSynced: [],
	registered: [],
	boundaryMarked: ["foo"],
};

const sync = (
	result: Effect.Effect<
		Repos.ReposSyncReport,
		Repos.ReposConfigError | Repos.GitSubmoduleError | Repos.ReposLockdownError
	>,
) => runReposSync("/repo").pipe(Effect.provide(ReposStub.manager({ sync: () => result })));

describe("repos sync", () => {
	it.effect("prints one line per actionable entry, exit 0", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(sync(Effect.succeed(activeReport)));
			expect(result.stdout).toEqual([
				[
					"✓ foo: cleared stale lock",
					"✓ bar: initialized",
					"✓ baz: sparse-checkout applied",
					"✓ qux: url reconciled",
					"✓ quux: registered",
				].join("\n"),
			]);
			expect(result.exitCode).toBe(0);
		}),
	);

	it.effect("says up to date when nothing changed (boundaryMarked is not news)", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(sync(Effect.succeed(emptyReport)));
			expect(result.stdout).toEqual(["✓ all vendored repos up to date"]);
		}),
	);

	// The session hook runs sync under a watchdog: a prompt would hang it.
	it.effect("never mounts anything, even at a terminal", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(sync(Effect.succeed(activeReport)));
			yield* Fiber.join(fiber);
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("with no manifest it says nothing is vendored and exits 0", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(sync(Effect.fail(ReposStub.configMissing)));
			expect(result.stdout).toEqual(["↷ no .repos/config.json — nothing vendored"]);
			expect(result.exitCode).toBe(0);
		}),
	);

	it.effect("each repos failure is a CommandError with a hint on stderr, exit 1, stdout empty", () =>
		Effect.gen(function* () {
			for (const [error, expected, hint] of [
				[ReposStub.configInvalid("invalid JSON"), "invalid JSON", "TIP: fix .repos/config.json"],
				[ReposStub.git("fatal: could not fetch"), "  fatal: could not fetch", "TIP: run `savvy repos status --drift`"],
				[ReposStub.lockdown("chmod failed: EACCES"), "chmod failed: EACCES", "TIP: run `savvy repos sync`"],
			] as const) {
				const result = yield* Capture.main(sync(Effect.fail(error)));
				expect(result.exitCode).toBe(1);
				expect(result.stdout).toEqual([]);
				const stderr = result.stderr.join("\n");
				expect(stderr).toContain("✗ could not sync the vendored repos");
				expect(stderr).toContain(expected);
				expect(stderr).toContain(hint);
			}
		}),
	);
});

import { afterEach, describe, expect, it } from "@effect/vitest";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
// `vi` is imported from `vitest` directly, NOT from `@effect/vitest`: vitest
// hoists `vi.mock(...)` above all imports, so a `vi` bound through the
// `@effect/vitest` re-export is not yet initialized when the hoisted call runs
// ("Cannot access '__vi_import_N__' before initialization").
import { vi } from "vitest";
import { runVersion } from "../../src/commands/changeset/commands/version.js";

vi.mock("../../src/commands/changeset/utils/config-gate.js", () => ({
	requireValidConfig: () => Effect.void,
}));

/** A logger that collects emitted messages so tests can assert on the command's output. */
const captureLogger = (sink: string[]) =>
	Logger.layer([
		Logger.make(({ message }) => {
			sink.push(Array.isArray(message) ? message.map(String).join(" ") : String(message));
		}),
	]);

/** A ReleasePlanner test layer that records how `apply` was invoked. */
const recordingPlanner = (result: Changesets.AppliedRelease, calls: Array<{ root: string; dryRun: boolean }>) =>
	Layer.succeed(
		Changesets.ReleasePlanner,
		Changesets.ReleasePlanner.of({
			plan: () => Effect.die("plan not used in this test"),
			preview: () => Effect.die("preview not used in this test"),
			apply: (root, options) => {
				calls.push({ root, dryRun: options?.dryRun ?? false });
				return Effect.succeed(result);
			},
		}),
	);

const applied: Changesets.AppliedRelease = {
	dryRun: false,
	touchedFiles: ["/p/packages/a/CHANGELOG.md", "/p/packages/a/package.json"],
	releases: [{ name: "@scope/a", type: "minor", oldVersion: "1.0.0", newVersion: "1.1.0" }],
	versionFileUpdates: [{ filePath: "/p/plugin.json", version: "1.1.0" }],
};

describe("runVersion", () => {
	afterEach(() => vi.restoreAllMocks());

	it.effect("delegates to ReleasePlanner.apply and reports each release", () =>
		Effect.gen(function* () {
			const calls: Array<{ root: string; dryRun: boolean }> = [];
			const logs: string[] = [];
			yield* runVersion(false).pipe(
				Effect.provide(recordingPlanner(applied, calls)),
				Effect.provide(captureLogger(logs)),
			) as Effect.Effect<void>;
			// Asserts observable behavior: the command invoked apply for the cwd and logged the bump.
			expect(calls).toEqual([{ root: process.cwd(), dryRun: false }]);
			expect(logs.join("\n")).toContain("@scope/a: 1.0.0 -> 1.1.0");
		}),
	);

	it.effect("passes the dry-run flag through to apply", () =>
		Effect.gen(function* () {
			const calls: Array<{ root: string; dryRun: boolean }> = [];
			yield* runVersion(true).pipe(
				Effect.provide(recordingPlanner({ ...applied, dryRun: true, touchedFiles: [] }, calls)),
				Effect.provide(captureLogger([])),
			) as Effect.Effect<void>;
			expect(calls[0]?.dryRun).toBe(true);
		}),
	);

	it.effect("reports no pending changesets when the plan is empty", () =>
		Effect.gen(function* () {
			const logs: string[] = [];
			const empty: Changesets.AppliedRelease = {
				dryRun: false,
				touchedFiles: [],
				releases: [],
				versionFileUpdates: [],
			};
			yield* runVersion(false).pipe(
				Effect.provide(recordingPlanner(empty, [])),
				Effect.provide(captureLogger(logs)),
			) as Effect.Effect<void>;
			expect(logs.join("\n")).toContain("No pending changesets.");
		}),
	);
});

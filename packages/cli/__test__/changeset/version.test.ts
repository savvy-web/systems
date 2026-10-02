import { afterEach, describe, expect, it } from "@effect/vitest";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";
// `vi` is imported from `vitest` directly, NOT from `@effect/vitest`: vitest
// hoists `vi.mock(...)` above all imports, so a `vi` bound through the
// `@effect/vitest` re-export is not yet initialized when the hoisted call runs
// ("Cannot access '__vi_import_N__' before initialization").
import { vi } from "vitest";
import { runVersion } from "../../src/commands/changeset/commands/version.js";
import { Capture } from "../utils/capture.js";

vi.mock("../../src/commands/changeset/utils/config-gate.js", () => ({
	requireValidConfig: () => Effect.void,
}));

/** Collects what the command prints on stdout — its output — so tests can assert on it. */
const captureLogger = (sink: string[]) => Capture.layer(sink);

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
			expect(logs.join("\n")).toContain("@scope/a  1.0.0 → 1.1.0  minor");
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
			expect(logs).toEqual(["✓ No pending changesets"]);
		}),
	);

	it.effect("prints each applied phase as it completes, before a later phase fails", () =>
		Effect.gen(function* () {
			const logs: string[] = [];
			const failingAfterEngine = Layer.succeed(
				Changesets.ReleasePlanner,
				Changesets.ReleasePlanner.of({
					plan: () => Effect.die("plan not used in this test"),
					preview: () => Effect.die("preview not used in this test"),
					apply: (_root, options) =>
						Effect.gen(function* () {
							yield* options?.onStep?.({
								_tag: "EngineApplied",
								touchedFiles: applied.touchedFiles,
								releases: applied.releases,
							}) ?? Effect.void;
							return yield* Effect.fail(new Changesets.ReleasePlanError({ phase: "apply", reason: "versionFiles" }));
						}),
				}),
			);
			const error = yield* runVersion(false).pipe(
				Effect.provide(failingAfterEngine),
				Effect.provide(captureLogger(logs)),
				Effect.flip,
			) as Effect.Effect<Changesets.ReleasePlanError>;
			expect(error._tag).toBe("ReleasePlanError");
			expect(logs).toEqual([RELEASED]);
		}),
	);

	it.effect("reports engine and versionFiles phases as separate entries when apply reports steps", () =>
		Effect.gen(function* () {
			const logs: string[] = [];
			const stepping = Layer.succeed(
				Changesets.ReleasePlanner,
				Changesets.ReleasePlanner.of({
					plan: () => Effect.die("plan not used in this test"),
					preview: () => Effect.die("preview not used in this test"),
					apply: (_root, options) =>
						Effect.gen(function* () {
							yield* options?.onStep?.({
								_tag: "EngineApplied",
								touchedFiles: applied.touchedFiles,
								releases: applied.releases,
							}) ?? Effect.void;
							yield* options?.onStep?.({ _tag: "VersionFilesUpdated", updates: applied.versionFileUpdates }) ??
								Effect.void;
							return applied;
						}),
				}),
			);
			yield* runVersion(false).pipe(
				Effect.provide(stepping),
				Effect.provide(captureLogger(logs)),
			) as Effect.Effect<void>;
			expect(logs).toEqual([RELEASED, "  Updated /p/plugin.json -> 1.1.0"]);
		}),
	);

	it.effect("prints a dry run as a plan-phrased releases table, for a person and an agent alike", () =>
		Effect.gen(function* () {
			const dry: Changesets.AppliedRelease = {
				...applied,
				dryRun: true,
				touchedFiles: [],
				releases: [
					...applied.releases,
					{ name: "@scope/longer-name", type: "patch", oldVersion: "0.1.0", newVersion: "0.1.1" },
				],
			};
			const expected = [
				[
					"Would release 2 packages:",
					"package             version        bump",
					"------------------  -------------  -----",
					"@scope/a            1.0.0 → 1.1.0  minor",
					"@scope/longer-name  0.1.0 → 0.1.1  patch",
					"  Would update /p/plugin.json -> 1.1.0",
				].join("\n"),
			];
			for (const audience of ["human", "agent"] as const) {
				// The config gate is mocked away, so ConfigInspector is never read.
				const run = runVersion(true).pipe(Effect.provide(recordingPlanner(dry, []))) as Effect.Effect<void>;
				const result = yield* Capture.run(run, { audience });
				expect(result.stdout).toEqual(expected);
			}
		}),
	);
});

/** What a real run prints when the engine step lands one release. */
const RELEASED = [
	"✓ Released 1 package",
	"package   version        bump",
	"--------  -------------  -----",
	"@scope/a  1.0.0 → 1.1.0  minor",
	"  Touched 2 file(s)",
].join("\n");

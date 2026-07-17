import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
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

	it("delegates to ReleasePlanner.apply and reports each release", async () => {
		const calls: Array<{ root: string; dryRun: boolean }> = [];
		const logs: string[] = [];
		await Effect.runPromise(
			runVersion(false).pipe(
				Effect.provide(recordingPlanner(applied, calls)),
				Effect.provide(captureLogger(logs)),
			) as Effect.Effect<void>,
		);
		// Asserts observable behavior: the command invoked apply for the cwd and logged the bump.
		expect(calls).toEqual([{ root: process.cwd(), dryRun: false }]);
		expect(logs.join("\n")).toContain("@scope/a: 1.0.0 -> 1.1.0");
	});

	it("passes the dry-run flag through to apply", async () => {
		const calls: Array<{ root: string; dryRun: boolean }> = [];
		await Effect.runPromise(
			runVersion(true).pipe(
				Effect.provide(recordingPlanner({ ...applied, dryRun: true, touchedFiles: [] }, calls)),
				Effect.provide(captureLogger([])),
			) as Effect.Effect<void>,
		);
		expect(calls[0]?.dryRun).toBe(true);
	});

	it("reports no pending changesets when the plan is empty", async () => {
		const logs: string[] = [];
		const empty: Changesets.AppliedRelease = { dryRun: false, touchedFiles: [], releases: [], versionFileUpdates: [] };
		await Effect.runPromise(
			runVersion(false).pipe(
				Effect.provide(recordingPlanner(empty, [])),
				Effect.provide(captureLogger(logs)),
			) as Effect.Effect<void>,
		);
		expect(logs.join("\n")).toContain("No pending changesets.");
	});
});

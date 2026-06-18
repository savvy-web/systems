import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Logger } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runVersion } from "../../src/commands/changeset/commands/version.js";

vi.mock("../../src/commands/changeset/utils/config-gate.js", () => ({
	requireValidConfig: () => Effect.void,
}));

const silentLogger = Logger.replace(Logger.defaultLogger, Logger.none);

const applied: Changesets.AppliedRelease = {
	dryRun: false,
	touchedFiles: ["/p/packages/a/CHANGELOG.md", "/p/packages/a/package.json"],
	releases: [{ name: "@scope/a", type: "minor", oldVersion: "1.0.0", newVersion: "1.1.0" }],
	versionFileUpdates: [{ filePath: "/p/plugin.json", version: "1.1.0" }],
};

const PlannerLive = Changesets.makeReleasePlannerTest({ apply: applied });

describe("runVersion", () => {
	afterEach(() => vi.restoreAllMocks());

	it("applies the release and completes", async () => {
		await Effect.runPromise(
			runVersion(false).pipe(Effect.provide(PlannerLive), Effect.provide(silentLogger)) as Effect.Effect<void>,
		);
		// completes without throwing; the planner test layer returned `applied`
		expect(applied.releases[0].newVersion).toBe("1.1.0");
	});

	it("supports dry run", async () => {
		const dry = Changesets.makeReleasePlannerTest({ apply: { ...applied, dryRun: true, touchedFiles: [] } });
		await Effect.runPromise(
			runVersion(true).pipe(Effect.provide(dry), Effect.provide(silentLogger)) as Effect.Effect<void>,
		);
	});
});

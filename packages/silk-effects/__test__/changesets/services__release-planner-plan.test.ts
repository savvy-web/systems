import { rmSync } from "node:fs";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { Changesets } from "../../src/index.js";
import { makeReleaseFixture } from "./fixtures/release-fixture.js";

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const _run = <A>(eff: Effect.Effect<A, unknown, Changesets.ReleasePlanner>) =>
	Effect.runPromise(
		eff.pipe(Effect.provide(Changesets.ReleasePlannerLive), Effect.provide(InspectorStub)) as Effect.Effect<A>,
	);

// plan() does not use ConfigInspector, but the Live layer requires it.
const InspectorStub = Changesets.makeConfigInspectorTest({
	configPath: "/x/.changeset/config.json",
	projectDir: "/x",
	changelog: "@changesets/cli/changelog",
	baseBranch: "main",
	access: "restricted",
	ignore: [],
	packages: [],
	legacyVersionFilesUsed: false,
});

describe("ReleasePlanner.plan", () => {
	it("computes releases and parsed changesets", async () => {
		const root = makeReleaseFixture({
			packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
			changesets: [{ id: "brave-pandas-learn", releases: { "@scope/a": "minor" }, summary: "feat: thing" }],
		});
		roots.push(root);
		const planner = await Effect.runPromise(
			Changesets.ReleasePlanner.pipe(
				Effect.provide(Changesets.ReleasePlannerLive),
				Effect.provide(InspectorStub),
			) as Effect.Effect<Changesets.ReleasePlannerShape>,
		);
		const plan = await Effect.runPromise(
			planner.plan(root) as unknown as Effect.Effect<{ releases: ReadonlyArray<{ name: string; newVersion: string }> }>,
		);
		expect(plan.releases.map((r) => [r.name, r.newVersion])).toEqual([["@scope/a", "1.1.0"]]);
	});
});

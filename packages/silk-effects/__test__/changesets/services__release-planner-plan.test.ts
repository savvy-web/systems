import { rmSync } from "node:fs";
import { NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { Changesets } from "../../src/index.js";
import { makeReleaseFixture } from "./support/release-fixture.js";

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

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
	it.effect("computes releases and parsed changesets", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brave-pandas-learn", releases: { "@scope/a": "minor" }, summary: "feat: thing" }],
			});
			roots.push(root);
			const planner = yield* Changesets.ReleasePlanner.pipe(
				Effect.provide(Changesets.ReleasePlanner.layer),
				Effect.provide(InspectorStub),
				Effect.provide(NodeServices.layer),
			);
			const plan = yield* planner.plan(root);
			expect(plan.releases.map((r) => [r.name, r.newVersion])).toEqual([["@scope/a", "1.1.0"]]);
		}),
	);
});

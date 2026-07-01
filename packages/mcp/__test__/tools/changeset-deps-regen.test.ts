import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspaceRoot } from "workspaces-effect";

import { ChangesetDepsRegenAsMarkdown, changesetDepsRegen } from "../../src/tools/changeset-deps-regen.js";

const ROOT = "/repo";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed(ROOT) }),
);

const cannedPlan = {
	toDelete: [{ file: "/repo/.changeset/stale-cats-sing.md", package: "@scope/foo" }],
	toWrite: [
		{
			file: "/repo/.changeset/brave-dogs-fly.md",
			package: "@scope/foo",
			diff: {
				package: "@scope/foo",
				relativePath: "packages/foo",
				rows: [{ dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.1" }],
			},
		},
	],
	skippedMixed: ["/repo/.changeset/mixed-owls-rest.md"],
} as unknown as Changesets.RegenPlan;

/** Build a stub layer that records whether `execute` was invoked. */
const makeStub = () => {
	const calls = { execute: 0 };
	const layer = Layer.succeed(
		Changesets.DepsRegen,
		Changesets.DepsRegen.of({
			plan: () => Effect.succeed(cannedPlan),
			execute: (p) => {
				calls.execute += 1;
				return Effect.succeed({
					deleted: p.toDelete.map((e) => e.file),
					written: p.toWrite.map((e) => e.file),
					skippedMixed: p.skippedMixed,
				});
			},
		}),
	);
	return { calls, layer };
};

const run = <A, E>(
	eff: Effect.Effect<A, E, WorkspaceRoot | Changesets.DepsRegen>,
	stub: Layer.Layer<Changesets.DepsRegen>,
) => Effect.runPromise(eff.pipe(Effect.provide(Layer.merge(WorkspaceRootTest, stub))));

describe("changesetDepsRegen handler", () => {
	it("dryRun=true does NOT call execute and reports the plan's intended files with dryRun:true", async () => {
		const { calls, layer } = makeStub();
		const data = await run(changesetDepsRegen({ dryRun: true }, ROOT), layer);
		expect(calls.execute).toBe(0);
		expect(data.dryRun).toBe(true);
		expect(data.root).toBe(ROOT);
		expect(data.deleted).toEqual(["/repo/.changeset/stale-cats-sing.md"]);
		expect(data.written).toEqual(["/repo/.changeset/brave-dogs-fly.md"]);
		expect(data.skippedMixed).toEqual(["/repo/.changeset/mixed-owls-rest.md"]);
	});

	it("dryRun absent DOES call execute and returns its result with dryRun:false", async () => {
		const { calls, layer } = makeStub();
		const data = await run(changesetDepsRegen({}, ROOT), layer);
		expect(calls.execute).toBe(1);
		expect(data.dryRun).toBe(false);
		expect(data.deleted).toEqual(["/repo/.changeset/stale-cats-sing.md"]);
		expect(data.written).toEqual(["/repo/.changeset/brave-dogs-fly.md"]);
	});

	it("renders markdown for the plan and forbids encoding back", async () => {
		const { layer } = makeStub();
		const data = await run(changesetDepsRegen({ dryRun: true }, ROOT), layer);
		const md = Schema.decodeSync(ChangesetDepsRegenAsMarkdown)(data);
		expect(md).toContain("brave-dogs-fly.md");
		expect(md).toContain("stale-cats-sing.md");
		expect(() => Schema.encodeSync(ChangesetDepsRegenAsMarkdown)("anything")).toThrow();
	});
});

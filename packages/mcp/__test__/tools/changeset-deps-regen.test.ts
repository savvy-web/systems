import { beforeEach, expect, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";

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

/**
 * Records whether `execute` was invoked and the plan options seen. The
 * suite-boundary layer below is built ONCE for the group, so this recorder is
 * cumulative across tests and is reset per test in `beforeEach`.
 */
const calls = { execute: 0, planOptions: [] as Changesets.DepsRegenOptions[] };

const DepsRegenStub = Layer.succeed(
	Changesets.DepsRegen,
	Changesets.DepsRegen.of({
		plan: (options) =>
			Effect.suspend(() => {
				calls.planOptions.push(options);
				return Effect.succeed(cannedPlan);
			}),
		execute: (p) =>
			Effect.suspend(() => {
				calls.execute += 1;
				return Effect.succeed({
					deleted: p.toDelete.map((e) => e.file),
					written: p.toWrite.map((e) => e.file),
					skippedMixed: p.skippedMixed,
				});
			}),
	}),
);

const TestLayer = Layer.merge(WorkspaceRootTest, DepsRegenStub);

layer(TestLayer)("changesetDepsRegen handler", (it) => {
	beforeEach(() => {
		calls.execute = 0;
		calls.planOptions.length = 0;
	});

	it.effect("dryRun=true does NOT call execute and reports the plan's intended files with dryRun:true", () =>
		Effect.gen(function* () {
			const data = yield* changesetDepsRegen({ dryRun: true }, ROOT);
			expect(calls.execute).toBe(0);
			expect(data.dryRun).toBe(true);
			expect(data.root).toBe(ROOT);
			expect(data.deleted).toEqual(["/repo/.changeset/stale-cats-sing.md"]);
			expect(data.written).toEqual(["/repo/.changeset/brave-dogs-fly.md"]);
			expect(data.skippedMixed).toEqual(["/repo/.changeset/mixed-owls-rest.md"]);
		}),
	);

	it.effect("dryRun absent DOES call execute and returns its result with dryRun:false", () =>
		Effect.gen(function* () {
			const data = yield* changesetDepsRegen({}, ROOT);
			expect(calls.execute).toBe(1);
			expect(data.dryRun).toBe(false);
			expect(data.deleted).toEqual(["/repo/.changeset/stale-cats-sing.md"]);
			expect(data.written).toEqual(["/repo/.changeset/brave-dogs-fly.md"]);
		}),
	);

	it.effect("forwards packages and exclude to plan(), omitting them when empty (#231)", () =>
		Effect.gen(function* () {
			yield* changesetDepsRegen(
				{ dryRun: true, packages: ["@scope/foo", "@scope/bar"], exclude: ["@scope/baz"] },
				ROOT,
			);
			yield* changesetDepsRegen({ dryRun: true, packages: [], exclude: [] }, ROOT);
			expect(calls.planOptions[0]).toMatchObject({ packages: ["@scope/foo", "@scope/bar"], exclude: ["@scope/baz"] });
			expect(calls.planOptions[1]).not.toHaveProperty("packages");
			expect(calls.planOptions[1]).not.toHaveProperty("exclude");
		}),
	);

	it.effect("renders markdown for the plan and forbids encoding back", () =>
		Effect.gen(function* () {
			const data = yield* changesetDepsRegen({ dryRun: true }, ROOT);
			const md = Schema.decodeUnknownSync(ChangesetDepsRegenAsMarkdown)(data);
			expect(md).toContain("brave-dogs-fly.md");
			expect(md).toContain("stale-cats-sing.md");
			expect(() => Schema.encodeUnknownSync(ChangesetDepsRegenAsMarkdown)("anything")).toThrow();
		}),
	);
});

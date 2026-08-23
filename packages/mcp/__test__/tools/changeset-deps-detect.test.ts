import { beforeEach, expect, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";

import { ChangesetDepsDetectAsMarkdown, changesetDepsDetect } from "../../src/tools/changeset-deps-detect.js";

const ROOT = "/repo";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed(ROOT) }),
);

/** A canned plan whose single toWrite entry keeps a devDependency row (detect keeps devDeps). */
const cannedPlan = {
	toDelete: [],
	toWrite: [
		{
			file: "/repo/.changeset/brave-dogs-fly.md",
			package: "@scope/foo",
			diff: {
				package: "@scope/foo",
				relativePath: "packages/foo",
				rows: [
					{ dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.1" },
					{ dependency: "typescript", type: "devDependency", action: "updated", from: "5.4.0", to: "5.5.0" },
				],
			},
		},
	],
	skippedMixed: [],
	coexisting: [{ file: "/repo/.changeset/sweet-cooks-guess.md", packages: ["@scope/foo"] }],
} as unknown as Changesets.RegenPlan;

/**
 * Recorder for the options the handler forwards to `plan()`. The suite-boundary
 * layer is built ONCE for the group, so this is cumulative across tests and is
 * reset per test in `beforeEach`. The assignment is wrapped in `Effect.suspend`
 * so it records when the effect RUNS, not when it is merely constructed.
 */
let capturedPlanOptions: Changesets.DepsRegenOptions | undefined;

const DepsRegenStub = Layer.succeed(
	Changesets.DepsRegen,
	Changesets.DepsRegen.of({
		plan: (options) =>
			Effect.suspend(() => {
				capturedPlanOptions = options;
				return Effect.succeed(cannedPlan);
			}),
		execute: (p) =>
			Effect.succeed({ deleted: [], written: [], skippedMixed: p.skippedMixed, coexisting: p.coexisting }),
	}),
);

const TestLayer = Layer.merge(WorkspaceRootTest, DepsRegenStub);

layer(TestLayer)("changesetDepsDetect handler", (it) => {
	beforeEach(() => {
		capturedPlanOptions = undefined;
	});

	it.effect("maps the plan's toWrite into { root, packages: [{ package, relativePath, rows }] }, keeping devDeps", () =>
		Effect.gen(function* () {
			const data = yield* changesetDepsDetect({}, ROOT);
			// The detect path must forward includeDevDeps:true so the service keeps devDeps.
			expect(capturedPlanOptions).toMatchObject({ cwd: ROOT, includeDevDeps: true });
			expect(data.root).toBe(ROOT);
			expect(data.packages).toHaveLength(1);
			const pkg = data.packages[0];
			expect(pkg?.package).toBe("@scope/foo");
			expect(pkg?.relativePath).toBe("packages/foo");
			expect(pkg?.rows).toHaveLength(2);
			// devDependency row is retained on the detect path
			expect(pkg?.rows.some((r) => r.type === "devDependency")).toBe(true);
			expect(pkg?.rows[0]?.dependency).toBe("effect");
			// Coexisting prose changesets are surfaced informationally (#279).
			expect(data.coexisting).toEqual([{ file: "/repo/.changeset/sweet-cooks-guess.md", packages: ["@scope/foo"] }]);
		}),
	);

	it.effect("renders the structured result as markdown including the devDependency row", () =>
		Effect.gen(function* () {
			const data = yield* changesetDepsDetect({}, ROOT);
			const md = Schema.decodeUnknownSync(ChangesetDepsDetectAsMarkdown)(data);
			expect(md).toContain("@scope/foo");
			expect(md).toContain("packages/foo");
			expect(md).toContain("effect");
			expect(md).toContain("typescript");
			expect(md).toContain("sweet-cooks-guess.md");
			expect(md).toContain("Coexisting prose changesets");
		}),
	);

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeUnknownSync(ChangesetDepsDetectAsMarkdown)("anything")).toThrow();
	});
});

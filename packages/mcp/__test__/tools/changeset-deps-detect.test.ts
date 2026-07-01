import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspaceRoot } from "workspaces-effect";

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
} as unknown as Changesets.RegenPlan;

const DepsRegenStub = Layer.succeed(
	Changesets.DepsRegen,
	Changesets.DepsRegen.of({
		plan: () => Effect.succeed(cannedPlan),
		execute: (p) => Effect.succeed({ deleted: [], written: [], skippedMixed: p.skippedMixed }),
	}),
);

const TestLayer = Layer.merge(WorkspaceRootTest, DepsRegenStub);

const run = <A, E>(eff: Effect.Effect<A, E, WorkspaceRoot | Changesets.DepsRegen>) =>
	Effect.runPromise(eff.pipe(Effect.provide(TestLayer)));

describe("changesetDepsDetect handler", () => {
	it("maps the plan's toWrite into { root, packages: [{ package, relativePath, rows }] }, keeping devDeps", async () => {
		const data = await run(changesetDepsDetect({}, ROOT));
		expect(data.root).toBe(ROOT);
		expect(data.packages).toHaveLength(1);
		const pkg = data.packages[0];
		expect(pkg?.package).toBe("@scope/foo");
		expect(pkg?.relativePath).toBe("packages/foo");
		expect(pkg?.rows).toHaveLength(2);
		// devDependency row is retained on the detect path
		expect(pkg?.rows.some((r) => r.type === "devDependency")).toBe(true);
		expect(pkg?.rows[0]?.dependency).toBe("effect");
	});

	it("renders the structured result as markdown including the devDependency row", async () => {
		const data = await run(changesetDepsDetect({}, ROOT));
		const md = Schema.decodeSync(ChangesetDepsDetectAsMarkdown)(data);
		expect(md).toContain("@scope/foo");
		expect(md).toContain("packages/foo");
		expect(md).toContain("effect");
		expect(md).toContain("typescript");
	});

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeSync(ChangesetDepsDetectAsMarkdown)("anything")).toThrow();
	});
});

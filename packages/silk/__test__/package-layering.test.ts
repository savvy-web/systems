/**
 * The repo's package graph honours the committed layering in `../layers.json`:
 * L4 silk → L3 cli/mcp/changelog → L2 silk-effects → L1 silk-core, with the
 * build tooling band beside them and the `@e2e/*` harness and the private
 * root unconstrained. It lives in silk because silk is the top of that graph.
 *
 * The checking itself — edge extraction per dependency field, classification,
 * cycle detection — is `@effected/workspaces/testing`'s `WorkspaceLayering`;
 * this file only holds the policy against the live workspace and proves the
 * check is not vacuous.
 */

import { join, resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Workspaces } from "@effected/workspaces";
import { LayerEdge, LayerPolicy, WorkspaceLayering } from "@effected/workspaces/testing";
import { Effect, Layer } from "effect";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const POLICY = join(import.meta.dirname, "../layers.json");

const WorkspaceLive = Workspaces.layer({ cwd: REPO_ROOT }).pipe(Layer.provideMerge(NodeServices.layer));

describe("package layering", () => {
	it.effect("the live workspace honours layers.json, with every required edge present", () =>
		Effect.gen(function* () {
			const policy = yield* LayerPolicy.load(POLICY);
			const report = yield* WorkspaceLayering.checkWorkspace(policy);
			expect(report.violations).toEqual([]);
			expect(report.edgeCount).toBeGreaterThan(10);
		}).pipe(Effect.provide(WorkspaceLive)),
	);

	it.effect("positive control: an upward edge and a sideways edge are both reported", () =>
		Effect.gen(function* () {
			const policy = yield* LayerPolicy.load(POLICY);
			const report = WorkspaceLayering.check(
				{
					names: ["@savvy-web/silk", "@savvy-web/cli", "@savvy-web/mcp", "@savvy-web/silk-core"],
					edges: [
						new LayerEdge({ from: "@savvy-web/silk-core", to: "@savvy-web/silk", field: "dependencies" }),
						new LayerEdge({ from: "@savvy-web/cli", to: "@savvy-web/mcp", field: "dependencies" }),
					],
				},
				policy,
			);
			expect(report.offenders.map((offender) => offender.reason).sort()).toEqual(["sameLayer", "upward"]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});

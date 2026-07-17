import { WorkspaceRoot } from "@effected/workspaces";
import { SilkWorkspaceAnalyzer, WorkspaceAnalysis } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { workspaceInfo } from "../../src/tools/workspace-info.js";

const fakeAnalysis = WorkspaceAnalysis.make({
	root: "/fake",
	runtime: "node",
	packageManager: { type: "pnpm" },
	workspaces: [],
	changesetConfig: null,
	versioning: null,
	tagStrategy: null,
});

const MockAnalyzer = Layer.succeed(
	SilkWorkspaceAnalyzer,
	SilkWorkspaceAnalyzer.of({ analyze: () => Effect.succeed(fakeAnalysis) }),
);

const MockRoot = Layer.succeed(WorkspaceRoot, WorkspaceRoot.of({ find: (cwd: string) => Effect.succeed(cwd) }));

describe("workspaceInfo handler", () => {
	it("runs against a mock analyzer and projects the result", async () => {
		const result = await Effect.runPromise(
			workspaceInfo("/fake").pipe(Effect.provide(Layer.mergeAll(MockAnalyzer, MockRoot))),
		);
		expect(result.root).toBe("/fake");
		expect(result.workspaceCount).toBe(0);
	});
});

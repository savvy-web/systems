import { expect, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { SilkWorkspaceAnalyzer, WorkspaceAnalysis } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";

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

layer(Layer.mergeAll(MockAnalyzer, MockRoot))("workspaceInfo handler", (it) => {
	it.effect("runs against a mock analyzer and projects the result", () =>
		Effect.gen(function* () {
			const result = yield* workspaceInfo("/fake");
			expect(result.root).toBe("/fake");
			expect(result.workspaceCount).toBe(0);
		}),
	);
});

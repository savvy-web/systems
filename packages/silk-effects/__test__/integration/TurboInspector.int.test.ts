import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Workspaces } from "@effected/workspaces";
import { Effect, Layer } from "effect";
import { ToolDiscoveryLive } from "../../src/services/ToolDiscovery.js";
import { TurboInspector, TurboInspectorLive } from "../../src/turbo/services/TurboInspector.js";

describe("TurboInspector (live layer)", () => {
	// Live stack: TurboInspectorLive needs ToolDiscovery | ChildProcessSpawner | FileSystem | Git.
	// ToolDiscoveryLive needs ChildProcessSpawner | PackageManagerDetector | WorkspaceRoot.
	// Workspaces.layerWithGit() supplies PackageManagerDetector + WorkspaceRoot + Git
	// (over FileSystem + Path + ChildProcessSpawner); NodeServices.layer supplies
	// ChildProcessSpawner + FileSystem + Path.
	const repoRoot = join(import.meta.dirname, "../../../..");
	const LiveStack = TurboInspectorLive.pipe(
		Layer.provide(ToolDiscoveryLive),
		Layer.provideMerge(Workspaces.layerWithGit()),
		Layer.provideMerge(NodeServices.layer),
	);

	it.effect("diagnoseCache reports per-task statuses for the real monorepo", () =>
		Effect.gen(function* () {
			const program = Effect.flatMap(TurboInspector, (t) => t.diagnoseCache("build:dev", repoRoot));
			const d = yield* program.pipe(Effect.provide(LiveStack));
			expect(d.totalTasks).toBeGreaterThan(0);
			expect(d.statuses.length).toBe(d.totalTasks);
		}),
	);
});

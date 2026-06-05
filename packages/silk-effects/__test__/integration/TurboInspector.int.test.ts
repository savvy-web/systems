import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspacesLive } from "workspaces-effect";
import { ToolDiscoveryLive } from "../../src/services/ToolDiscovery.js";
import { TurboInspector, TurboInspectorLive } from "../../src/turbo/services/TurboInspector.js";

describe("TurboInspector (live layer)", () => {
	// Live stack: TurboInspectorLive needs ToolDiscovery | CommandExecutor | FileSystem.
	// ToolDiscoveryLive needs CommandExecutor | PackageManagerDetector | WorkspaceRoot.
	// WorkspacesLive supplies PackageManagerDetector + WorkspaceRoot (over FileSystem + Path);
	// NodeContext.layer supplies CommandExecutor + FileSystem + Path.
	const repoRoot = join(import.meta.dirname, "../../../..");
	const LiveStack = TurboInspectorLive.pipe(
		Layer.provide(ToolDiscoveryLive),
		Layer.provideMerge(WorkspacesLive),
		Layer.provideMerge(NodeContext.layer),
	);

	it("diagnoseCache reports per-task statuses for the real monorepo", async () => {
		const program = Effect.flatMap(TurboInspector, (t) => t.diagnoseCache("build:dev", repoRoot));
		const d = await Effect.runPromise(program.pipe(Effect.provide(LiveStack)));
		expect(d.totalTasks).toBeGreaterThan(0);
		expect(d.statuses.length).toBe(d.totalTasks);
	});
});

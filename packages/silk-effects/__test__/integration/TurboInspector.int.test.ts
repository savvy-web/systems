import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ToolDiscovery } from "@effected/commands";
import { Workspaces } from "@effected/workspaces";
import { Effect, Layer } from "effect";
import { TurboInspector } from "../../src/turbo/services/TurboInspector.js";

describe("TurboInspector (live layer)", () => {
	// Live stack: TurboInspector.layer needs ToolDiscovery | ChildProcessSpawner | FileSystem | Git.
	// The kit's ToolDiscovery.layer needs ChildProcessSpawner | LocalExec, and
	// Workspaces.localExecLayer() implements LocalExec over PackageManagerDetector +
	// WorkspaceRoot. Workspaces.layerWithGit() supplies those two plus Git (over
	// FileSystem + Path + ChildProcessSpawner); NodeServices.layer supplies
	// ChildProcessSpawner + FileSystem + Path.
	const repoRoot = join(import.meta.dirname, "../../../..");
	const LiveStack = TurboInspector.layer.pipe(
		Layer.provide(ToolDiscovery.layer.pipe(Layer.provide(Workspaces.localExecLayer()))),
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

	// `affected` is the ONLY path that sets an environment variable
	// (`TURBO_SCM_BASE`), which makes it the live guard on the child process
	// still inheriting the parent environment. Core's `ChildProcess.setEnv`
	// writes `options.env` without setting `extendEnv`, and the Node spawner
	// then passes ONLY those vars to the child — so a `turbo` spawned that way
	// has no `PATH` and cannot start. If the `Run.extendEnv` wiring in
	// TurboInspector ever regresses to a bare `setEnv`, this test fails at the
	// spawn rather than silently changing what every turbo invocation inherits.
	// The base is HEAD, not a branch name: CI checks out a detached merge
	// commit with no local `main` ref, and any base that turbo can diff
	// exercises the env guard equally (the child must have PATH to run at all).
	it.effect("affected passes TURBO_SCM_BASE without discarding the inherited environment", () =>
		Effect.gen(function* () {
			const program = Effect.flatMap(TurboInspector, (t) => t.affected(repoRoot, "HEAD"));
			const result = yield* program.pipe(Effect.provide(LiveStack));
			expect(result.base).toBe("HEAD");
			expect(Array.isArray(result.packages)).toBe(true);
			expect(Array.isArray(result.dependents)).toBe(true);
		}),
	);
});

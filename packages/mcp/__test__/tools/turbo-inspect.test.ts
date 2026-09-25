import { describe, expect, it, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Turbo } from "@savvy-web/silk-effects";
import { Effect, Layer, Result, Schema } from "effect";

import {
	TurboInspectParams,
	TurboInspectResult,
	turboInspect,
	turboInspectTool,
} from "../../src/tools/turbo-inspect.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed("/repo") }),
);

const TurboInspectorTest = Layer.succeed(
	Turbo.TurboInspector,
	Turbo.TurboInspector.of({
		diagnoseCache: (task, _cwd) =>
			Effect.succeed({
				task,
				totalTasks: 2,
				hits: 1,
				misses: 1,
				statuses: [],
				explanations: [
					{
						package: "@savvy-web/bundler",
						taskId: "@savvy-web/bundler#build:dev",
						hash: "h",
						inputFileCount: 1,
						hashedEnvVars: ["NODE_ENV"],
						externalDependenciesHash: "x",
						dependsOn: [],
					},
				],
				global: {
					rootKey: "rk",
					globalFileCount: 1,
					externalDependenciesHash: "x",
					internalDependenciesHash: "y",
					globalEnvVars: ["CI"],
				},
			}),
		taskGraph: (_cwd, task) =>
			Effect.succeed({
				...(task ? { task } : {}),
				nodeCount: 1,
				nodes: [{ taskId: "a#build:dev", package: "a", dependsOn: [] }],
				criticalPath: ["a#build:dev"],
			}),
		affected: (_cwd, base) => Effect.succeed({ base: base ?? "HEAD", packages: ["a"], dependents: ["b"] }),
	}),
);

const TestLayer = Layer.mergeAll(TurboInspectorTest, WorkspaceRootTest);

layer(TestLayer)("turboInspect handler", (it) => {
	it.effect("projects the cache mode", () =>
		Effect.gen(function* () {
			const data = yield* turboInspect({ mode: "cache", task: "build:dev" }, "/repo");
			expect(data.mode).toBe("cache");
			expect(data.mode === "cache" ? data.result.misses : undefined).toBe(1);
		}),
	);

	it.effect("projects the graph mode", () =>
		Effect.gen(function* () {
			const data = yield* turboInspect({ mode: "graph" }, "/repo");
			expect(data.mode).toBe("graph");
			expect(data.mode === "graph" ? data.result.criticalPath : []).toEqual(["a#build:dev"]);
		}),
	);

	it.effect("projects the affected mode", () =>
		Effect.gen(function* () {
			const data = yield* turboInspect({ mode: "affected", base: "main" }, "/repo");
			expect(data.mode).toBe("affected");
			expect(data.mode === "affected" ? data.result.packages : []).toEqual(["a"]);
		}),
	);
});

describe("turbo_inspect served schemas", () => {
	it("the result union accepts a valid graph payload", () => {
		expect(TurboInspectResult).toBeDefined();
		const parsed = Schema.decodeUnknownResult(TurboInspectResult)({
			mode: "graph",
			result: { nodeCount: 0, nodes: [], criticalPath: [] },
		});
		expect(Result.isSuccess(parsed)).toBe(true);
	});

	it("the parameters schema rejects an unknown mode at the wire boundary", () => {
		expect(Result.isFailure(Schema.decodeUnknownResult(TurboInspectParams)({ mode: "bogus" }))).toBe(true);
		expect(turboInspectTool.name).toBe("turbo_inspect");
	});
});

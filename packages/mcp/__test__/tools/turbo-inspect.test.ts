import { describe, expect, it, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Turbo } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";

import { effectToZodSchema } from "../../src/schema/effect-to-zod.js";
import { TurboInspectAsMarkdown, TurboInspectResult, turboInspect } from "../../src/tools/turbo-inspect.js";

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
	it.effect("projects the cache mode and renders markdown", () =>
		Effect.gen(function* () {
			const data = yield* turboInspect({ mode: "cache", task: "build:dev" }, "/repo");
			expect(data.mode).toBe("cache");
			const md = Schema.decodeUnknownSync(TurboInspectAsMarkdown)(data);
			expect(md).toContain("turbo cache");
			expect(md).toContain("Misses");
		}),
	);

	it.effect("projects the graph mode", () =>
		Effect.gen(function* () {
			const data = yield* turboInspect({ mode: "graph" }, "/repo");
			expect(data.mode).toBe("graph");
			const md = Schema.decodeUnknownSync(TurboInspectAsMarkdown)(data);
			expect(md).toContain("turbo task graph");
			expect(md).toContain("a#build:dev");
		}),
	);

	it.effect("projects the affected mode", () =>
		Effect.gen(function* () {
			const data = yield* turboInspect({ mode: "affected", base: "main" }, "/repo");
			expect(data.mode).toBe("affected");
			const md = Schema.decodeUnknownSync(TurboInspectAsMarkdown)(data);
			expect(md).toContain("turbo affected");
			expect(md).toContain("- a");
		}),
	);

	it("forbids encoding markdown back to the structured result", () => {
		expect(() => Schema.encodeUnknownSync(TurboInspectAsMarkdown)("anything")).toThrow();
	});
});

describe("turbo_inspect effect->zod bridge", () => {
	it("converts the result union and parses a valid graph payload", () => {
		const zodSchema = effectToZodSchema(TurboInspectResult);
		expect(zodSchema).toBeDefined();
		const parsed = zodSchema.safeParse({
			mode: "graph",
			result: { nodeCount: 0, nodes: [], criticalPath: [] },
		});
		expect(parsed.success).toBe(true);
	});
});

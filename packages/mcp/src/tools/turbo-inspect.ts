/**
 * The `turbo_inspect` MCP tool: a discriminated-union result schema keyed by
 * `mode` (cache | graph | affected), each variant embedding the corresponding
 * `Turbo` result schema from silk-effects. Read-only.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Turbo } from "@savvy-web/silk-effects";
import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, mapEngineError } from "../errors.js";

/** Cache-diagnosis variant of the `turbo_inspect` result. */
export const TurboCacheResult = Schema.Struct({
	mode: Schema.Literal("cache"),
	result: Turbo.CacheDiagnosis,
}).annotate({ identifier: "TurboCacheResult" });

/** Task-graph variant of the `turbo_inspect` result. */
export const TurboGraphResult = Schema.Struct({
	mode: Schema.Literal("graph"),
	result: Turbo.TaskGraphResult,
}).annotate({ identifier: "TurboGraphResult" });

/** Affected-packages variant of the `turbo_inspect` result. */
export const TurboAffectedResult = Schema.Struct({
	mode: Schema.Literal("affected"),
	result: Turbo.AffectedResult,
}).annotate({ identifier: "TurboAffectedResult" });

/** The `turbo_inspect` tool result — a discriminated union keyed by `mode`. */
export const TurboInspectResult = Schema.Union([TurboCacheResult, TurboGraphResult, TurboAffectedResult]).annotate({
	identifier: "TurboInspectResult",
	title: "turbo_inspect result",
	description: "Read-only Turborepo inspection grouped by mode (cache | graph | affected).",
});

export type TurboInspectResultType = Schema.Schema.Type<typeof TurboInspectResult>;

/** Arguments for the {@link turboInspect} handler. */
export interface TurboInspectArgs {
	readonly mode: "cache" | "graph" | "affected";
	readonly task?: string;
	readonly base?: string;
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root by walking up from the requested
 * directory, then dispatch to the matching {@link Turbo.TurboInspector} method
 * keyed by `mode`. Mirrors `workspaceInfo`'s `WorkspaceRoot.find` resolution.
 */
export const turboInspect = (
	args: TurboInspectArgs,
	fallbackCwd: string,
): Effect.Effect<
	TurboInspectResultType,
	Turbo.TurboError | WorkspaceRootNotFoundError,
	Turbo.TurboInspector | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		const inspector = yield* Turbo.TurboInspector;
		switch (args.mode) {
			case "cache": {
				const result = yield* inspector.diagnoseCache(args.task ?? "build:dev", root);
				return { mode: "cache", result } as TurboInspectResultType;
			}
			case "graph": {
				const result = yield* inspector.taskGraph(root, args.task);
				return { mode: "graph", result } as TurboInspectResultType;
			}
			case "affected": {
				const result = yield* inspector.affected(root, args.base);
				return { mode: "affected", result } as TurboInspectResultType;
			}
		}
	});

/** Wire parameters for `turbo_inspect`. */
export const TurboInspectParams = Schema.Struct({
	mode: Schema.Literals(["cache", "graph", "affected"]).annotate({ description: "Which inspection to run." }),
	task: Schema.optionalKey(
		Schema.String.annotate({ description: "Task name (defaults to build:dev for cache/graph)." }),
	),
	base: Schema.optionalKey(Schema.String.annotate({ description: "Base git ref for affected mode." })),
	cwd: Schema.optionalKey(Schema.String.annotate({ description: "Directory to resolve the workspace root from." })),
});
export type TurboInspectParams = typeof TurboInspectParams.Type;

const REMEDIATION = {
	hint: "turbo could not complete the dry run; check that the task exists in turbo.json and that turbo resolves from the workspace.",
};

/** The `turbo_inspect` tool value. */
export const turboInspectTool = Tool.make("turbo_inspect", {
	description:
		"Read-only Turborepo inspection. mode=cache diagnoses why a task's cache is hitting/missing (per-package status plus the exact hash contributors: input files, env vars, external-dep hashes, global hash). mode=graph returns the task graph and critical path. mode=affected lists changed packages and their dependents. Never executes tasks (uses --dry). Returns a typed object in structuredContent (content[] carries the same object as JSON).",
	parameters: TurboInspectParams,
	success: TurboInspectResult,
	failure: McpToolError,
	dependencies: [Turbo.TurboInspector, WorkspaceRoot],
})
	.annotate(Tool.Title, "Inspect Turborepo")
	.annotate(Tool.Readonly, true)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, true)
	.annotate(Tool.OpenWorld, false);

/** Wire handler: {@link turboInspect} with its error channel mapped onto {@link McpToolError}. */
export const handleTurboInspect = (fallbackCwd: string, params: TurboInspectParams) =>
	turboInspect(params, fallbackCwd).pipe(Effect.mapError(mapEngineError(params.cwd ?? fallbackCwd, REMEDIATION)));

/**
 * The `turbo_inspect` MCP tool: a discriminated-union result schema keyed by
 * `mode` (cache | graph | affected), each variant embedding the corresponding
 * `Turbo` result schema from silk-effects, plus a one-way markdown transform.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Turbo } from "@savvy-web/silk-effects";
import { Effect, Schema, SchemaGetter } from "effect";
import { Tool } from "effect/unstable/ai";
import { McpToolError, mapEngineError } from "../errors.js";
import { SilkMarkdown } from "../markdown.js";

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

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: TurboInspectResultType): string => {
	switch (data.mode) {
		case "cache": {
			const r = data.result;
			const lines = [
				`# turbo cache — ${r.task}`,
				``,
				`**${r.hits}/${r.totalTasks} cached**, ${r.misses} miss(es).`,
				``,
				`## Global hash`,
				`- rootKey: \`${r.global.rootKey}\``,
				`- global files: ${r.global.globalFileCount}`,
				`- external deps hash: \`${r.global.externalDependenciesHash}\``,
				`- internal deps hash: \`${r.global.internalDependenciesHash}\``,
				`- global env: ${r.global.globalEnvVars.join(", ") || "(none)"}`,
			];
			if (r.explanations.length > 0) {
				lines.push(``, `## Misses`);
				for (const m of r.explanations) {
					lines.push(
						`### ${m.package} (\`${m.taskId}\`)`,
						`- hash: \`${m.hash}\``,
						`- input files: ${m.inputFileCount}`,
						`- hashed env: ${m.hashedEnvVars.join(", ") || "(none)"}`,
						`- external deps hash: \`${m.externalDependenciesHash}\``,
						`- depends on: ${m.dependsOn.join(", ") || "(none)"}`,
					);
				}
			}
			return lines.join("\n");
		}
		case "graph": {
			const r = data.result;
			return [
				`# turbo task graph${r.task ? ` — ${r.task}` : ""}`,
				``,
				`${r.nodeCount} task node(s).`,
				``,
				`## Critical path`,
				r.criticalPath.map((id, i) => `${i + 1}. \`${id}\``).join("\n") || "(empty)",
			].join("\n");
		}
		case "affected": {
			const r = data.result;
			return [
				`# turbo affected — base ${r.base}`,
				``,
				`## Changed packages`,
				r.packages.map((p) => `- ${p}`).join("\n") || "(none)",
				``,
				`## Dependents`,
				r.dependents.map((p) => `- ${p}`).join("\n") || "(none)",
			].join("\n");
		}
	}
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const TurboInspectAsMarkdown = TurboInspectResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "TurboInspectAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

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
		"Read-only Turborepo inspection. mode=cache diagnoses why a task's cache is hitting/missing (per-package status plus the exact hash contributors: input files, env vars, external-dep hashes, global hash). mode=graph returns the task graph and critical path. mode=affected lists changed packages and their dependents. Never executes tasks (uses --dry).",
	parameters: TurboInspectParams,
	success: TurboInspectResult,
	failure: McpToolError,
	dependencies: [Turbo.TurboInspector, WorkspaceRoot],
})
	.annotate(Tool.Title, "Inspect Turborepo")
	.annotate(Tool.Readonly, true)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, true)
	.annotate(Tool.OpenWorld, false)
	.annotate(SilkMarkdown, Schema.decodeUnknownSync(TurboInspectAsMarkdown));

/** Wire handler: {@link turboInspect} with its error channel mapped onto {@link McpToolError}. */
export const handleTurboInspect = (fallbackCwd: string, params: TurboInspectParams) =>
	turboInspect(params, fallbackCwd).pipe(Effect.mapError(mapEngineError(params.cwd ?? fallbackCwd, REMEDIATION)));

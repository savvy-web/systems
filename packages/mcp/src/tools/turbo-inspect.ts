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

import { CommandExecutor, FileSystem } from "@effect/platform";
import { Context, Effect, Layer, Schema } from "effect";
import { ToolDefinition } from "../../schemas/ToolDefinition.js";
import { ToolDiscovery } from "../../services/ToolDiscovery.js";
import { TurboDigest } from "../digest.js";
import type { TurboError } from "../errors.js";
import { DryRunParseError, NotATurboRepoError, TurboExecError, TurboNotInstalledError } from "../errors.js";
import type { TurboDryRunType } from "../schemas/DryRun.js";
import { TurboDryRun } from "../schemas/DryRun.js";
import type { AffectedResultType, CacheDiagnosisType, TaskGraphResultType } from "../schemas/results.js";

/**
 * Read-only Turborepo inspector. All operations use `--dry` and never execute tasks.
 * Surfaced through the MCP `turbo_inspect` tool.
 *
 * @remarks
 * Methods take an explicit `cwd` (the MCP tool handler resolves the workspace root
 * and passes it). Output is decoded with {@link TurboDryRun} and digested by
 * {@link TurboDigest}.
 *
 * @since 0.7.0
 */
export class TurboInspector extends Context.Tag("@savvy-web/silk-effects/TurboInspector")<
	TurboInspector,
	{
		/**
		 * Diagnose the cache state of `task` by running `turbo run <task> --dry=json`
		 * in `cwd` and digesting the per-package HIT/MISS breakdown.
		 *
		 * @since 0.7.0
		 */
		readonly diagnoseCache: (task: string, cwd: string) => Effect.Effect<CacheDiagnosisType, TurboError>;

		/**
		 * Derive the task graph (and its critical path) for an optional `task`
		 * by running `turbo run <task> --dry=json` in `cwd`.
		 *
		 * @since 0.7.0
		 */
		readonly taskGraph: (cwd: string, task?: string) => Effect.Effect<TaskGraphResultType, TurboError>;

		/**
		 * Compute the affected packages relative to `base` (default `HEAD^`) by
		 * running `turbo run build:dev --affected --dry=json` in `cwd`.
		 *
		 * @since 0.7.0
		 */
		readonly affected: (cwd: string, base?: string) => Effect.Effect<AffectedResultType, TurboError>;
	}
>() {}

const TURBO = ToolDefinition.make({ name: "turbo" });

/** Default task used by {@link TurboInspector.taskGraph} and {@link TurboInspector.affected}. */
const DEFAULT_BUILD_TASK = "build:dev";

/**
 * Live implementation of {@link TurboInspector}.
 *
 * @remarks
 * Requires {@link ToolDiscovery} to resolve the `turbo` binary, plus
 * `CommandExecutor` and `FileSystem` from `@effect/platform`. Mirrors
 * `ToolDiscoveryLive`: the executor is captured at layer construction and
 * discharged onto each command effect with `Effect.provideService`, keeping
 * the public method effects at `R = never`.
 *
 * @since 0.7.0
 */
export const TurboInspectorLive: Layer.Layer<
	TurboInspector,
	never,
	ToolDiscovery | CommandExecutor.CommandExecutor | FileSystem.FileSystem
> = Layer.effect(
	TurboInspector,
	Effect.gen(function* () {
		const discovery = yield* ToolDiscovery;
		const executor = yield* CommandExecutor.CommandExecutor;
		const fs = yield* FileSystem.FileSystem;

		const runTurbo = (
			cwd: string,
			args: ReadonlyArray<string>,
		): Effect.Effect<string, TurboNotInstalledError | TurboExecError> =>
			discovery.require(TURBO).pipe(
				Effect.mapError((e) => new TurboNotInstalledError({ reason: e.reason })),
				Effect.flatMap((resolved) =>
					Effect.provideService(
						resolved
							.exec(...args)
							.workingDirectory(cwd)
							.string(),
						CommandExecutor.CommandExecutor,
						executor,
					).pipe(Effect.mapError((e) => new TurboExecError({ args: [...args], reason: String(e) }))),
				),
			);

		const ensureTurboRepo = (cwd: string): Effect.Effect<void, NotATurboRepoError> =>
			fs.exists(`${cwd}/turbo.json`).pipe(
				Effect.catchAll(() => Effect.succeed(false)),
				Effect.flatMap((ok) => (ok ? Effect.void : Effect.fail(new NotATurboRepoError({ cwd })))),
			);

		const dryRun = (
			task: string,
			cwd: string,
			args: ReadonlyArray<string>,
		): Effect.Effect<TurboDryRunType, TurboError> =>
			ensureTurboRepo(cwd).pipe(
				Effect.flatMap(() => runTurbo(cwd, args)),
				Effect.flatMap((stdout) =>
					Effect.try({
						try: () => JSON.parse(stdout) as unknown,
						catch: (e) => new DryRunParseError({ task, reason: `invalid JSON: ${String(e)}` }),
					}),
				),
				Effect.flatMap((json) =>
					Schema.decodeUnknown(TurboDryRun)(json).pipe(
						Effect.mapError((e) => new DryRunParseError({ task, reason: String(e) })),
					),
				),
			);

		return TurboInspector.of({
			diagnoseCache: (task, cwd) =>
				dryRun(task, cwd, ["run", task, "--dry=json"]).pipe(Effect.map((dry) => TurboDigest.cacheDiagnosis(task, dry))),
			taskGraph: (cwd, task) => {
				const t = task ?? DEFAULT_BUILD_TASK;
				return dryRun(t, cwd, ["run", t, "--dry=json"]).pipe(Effect.map((dry) => TurboDigest.taskGraph(dry, t)));
			},
			affected: (cwd, base) =>
				dryRun("affected", cwd, ["run", DEFAULT_BUILD_TASK, "--affected", "--dry=json"]).pipe(
					Effect.map((dry) =>
						TurboDigest.affected(base ?? "HEAD^", [...new Set(dry.tasks.map((task) => task.package))], dry),
					),
				),
		});
	}),
);

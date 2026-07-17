import { Git } from "@effected/git";
import { Context, Effect, FileSystem, Layer, Schema } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import { ToolDefinition } from "../../schemas/ToolDefinition.js";
import { ToolDiscovery } from "../../services/ToolDiscovery.js";
import { TurboDigest } from "../digest.js";
import type { TurboError } from "../errors.js";
import { DryRunParseError, NotATurboRepoError, TurboExecError, TurboNotInstalledError } from "../errors.js";
import type { TurboDryRunType } from "../schemas/DryRun.js";
import { TurboDryRun } from "../schemas/DryRun.js";
import type { AffectedResultType, CacheDiagnosisType, TaskGraphResultType } from "../schemas/results.js";

/**
 * The {@link TurboInspector} service shape.
 *
 * @since 3.2.0
 * @public
 */
export interface TurboInspectorShape {
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
	 * Compute the packages affected relative to `base` (default `main`), split into
	 * the directly-changed packages and their dependents. Runs
	 * `turbo run build:dev --affected --dry=json` (with `TURBO_SCM_BASE=<base>`) for the
	 * affected set and `git diff --name-only <base>...HEAD` to identify which of those
	 * packages actually changed; everything else in the set is a dependent.
	 *
	 * @since 0.7.0
	 */
	readonly affected: (cwd: string, base?: string) => Effect.Effect<AffectedResultType, TurboError>;
}

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
export class TurboInspector extends Context.Service<TurboInspector, TurboInspectorShape>()(
	"@savvy-web/silk-effects/TurboInspector",
) {}

const TURBO = ToolDefinition.make({ name: "turbo" });

/** Default task used by {@link TurboInspector.taskGraph} and {@link TurboInspector.affected}. */
const DEFAULT_BUILD_TASK = "build:dev";

/** Default git ref `affected` compares against — matches Turborepo's own `--affected` default. */
const DEFAULT_AFFECTED_BASE = "main";

/**
 * Live implementation of {@link TurboInspector}.
 *
 * @remarks
 * Requires {@link ToolDiscovery} to resolve the `turbo` binary, plus
 * `ChildProcessSpawner` and `FileSystem` from core (provide `NodeServices.layer`
 * at the app edge) and `Git` from `@effected/git`. Mirrors `ToolDiscoveryLive`:
 * the spawner is captured at layer construction and discharged onto each command
 * effect with `Effect.provideService`, keeping the public method effects at
 * `R = never`.
 *
 * @since 0.7.0
 */
export const TurboInspectorLive: Layer.Layer<
	TurboInspector,
	never,
	ToolDiscovery | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Git
> = Layer.effect(
	TurboInspector,
	Effect.gen(function* () {
		const discovery = yield* ToolDiscovery;
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const fs = yield* FileSystem.FileSystem;
		const git = yield* Git;

		const runTurbo = (
			cwd: string,
			args: ReadonlyArray<string>,
			env?: Record<string, string>,
		): Effect.Effect<string, TurboNotInstalledError | TurboExecError> =>
			discovery.require(TURBO).pipe(
				Effect.mapError((e) => new TurboNotInstalledError({ reason: e.reason })),
				Effect.flatMap((resolved) => {
					const command = resolved.exec(...args).workingDirectory(cwd);
					return Effect.provideService(
						(env ? command.env(env) : command).string(),
						ChildProcessSpawner.ChildProcessSpawner,
						spawner,
					).pipe(Effect.mapError((e) => new TurboExecError({ args: [...args], reason: String(e) })));
				}),
			);

		/** The paths changed between `base` and HEAD, via `@effected/git`. */
		const changedPaths = (cwd: string, base: string): Effect.Effect<ReadonlyArray<string>, TurboExecError> =>
			git
				.changedFiles(cwd, { base, head: "HEAD" })
				.pipe(
					Effect.mapError(
						(e) => new TurboExecError({ args: ["git", "diff", "--name-only", `${base}...HEAD`], reason: e.message }),
					),
				);

		const ensureTurboRepo = (cwd: string): Effect.Effect<void, NotATurboRepoError> =>
			fs.exists(`${cwd}/turbo.json`).pipe(
				Effect.catch(() => Effect.succeed(false)),
				Effect.flatMap((ok) => (ok ? Effect.void : Effect.fail(new NotATurboRepoError({ cwd })))),
			);

		const dryRun = (
			task: string,
			cwd: string,
			args: ReadonlyArray<string>,
			env?: Record<string, string>,
		): Effect.Effect<TurboDryRunType, TurboError> =>
			ensureTurboRepo(cwd).pipe(
				Effect.flatMap(() => runTurbo(cwd, args, env)),
				Effect.flatMap((stdout) =>
					Effect.try({
						try: () => JSON.parse(stdout) as unknown,
						catch: (e) => new DryRunParseError({ task, reason: `invalid JSON: ${String(e)}` }),
					}),
				),
				Effect.flatMap((json) =>
					Schema.decodeUnknownEffect(TurboDryRun)(json).pipe(
						Effect.mapError((e) => new DryRunParseError({ task, reason: String(e) })),
					),
				),
			);

		return {
			diagnoseCache: (task, cwd) =>
				dryRun(task, cwd, ["run", task, "--dry=json"]).pipe(Effect.map((dry) => TurboDigest.cacheDiagnosis(task, dry))),
			taskGraph: (cwd, task) => {
				const t = task ?? DEFAULT_BUILD_TASK;
				// Run the resolved task, but echo the caller's original `task` into the
				// result so the `task` key is omitted when no specific task was requested
				// (matching TurboDigest.taskGraph's contract).
				return dryRun(t, cwd, ["run", t, "--dry=json"]).pipe(Effect.map((dry) => TurboDigest.taskGraph(dry, task)));
			},
			affected: (cwd, base) => {
				const ref = base ?? DEFAULT_AFFECTED_BASE;
				// `--affected` expands to changed packages AND their dependents; pair it with
				// `git diff` (same base, via TURBO_SCM_BASE) to recover which packages directly
				// changed versus which are only dependents.
				return Effect.all({
					changedFiles: changedPaths(cwd, ref),
					dry: dryRun(
						`${DEFAULT_BUILD_TASK} --affected`,
						cwd,
						["run", DEFAULT_BUILD_TASK, "--affected", "--dry=json"],
						{ TURBO_SCM_BASE: ref },
					),
				}).pipe(Effect.map(({ changedFiles, dry }) => TurboDigest.affected(ref, changedFiles, dry)));
			},
		};
	}),
);

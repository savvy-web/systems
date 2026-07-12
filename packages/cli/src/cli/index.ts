/**
 * Root `savvy` CLI entry point using `@effect/cli`.
 *
 * @remarks
 * Assembles the five Phase-B command pieces — the `init` and `check` top-level
 * orchestrators plus the `changeset`, `commit`, and `lint` groups — under a
 * single `savvy` root command, then provides the merged runtime Layer stack
 * that satisfies every command's service requirements.
 *
 * The layer stack is the union of the three standalone CLIs' stacks
 * (`@savvy-web/changesets`, `@savvy-web/commitlint`, `@savvy-web/lint-staged`),
 * with each service's transitive dependencies wired:
 *
 * - `NodeContext.layer` — `FileSystem`, `Path`, and `CommandExecutor`, consumed
 *   by every config reader, workspace service, and tool-discovery layer.
 * - Workspace services — `WorkspaceRootLive`, `PackageManagerDetectorLive`, and
 *   `WorkspaceDiscoveryLive` (provided `WorkspaceRootLive`), the minimal hand-wired
 *   trio shared by the three source CLIs.
 * - Flat silk-effects services — `ChangesetConfigReaderLive`,
 *   `SilkPublishabilityDetectorLive`, `ManagedSectionLive`, `BiomeSchemaSyncLive`,
 *   `ConfigDiscoveryLive`, `ToolDiscoveryLive`, and `VersioningStrategyLive`
 *   (provided `ChangesetConfigReaderLive`).
 * - Changesets-namespace services — `Changesets.ConfigInspectorLive` (provided
 *   `ChangesetConfigReaderLive`), `Changesets.ReleasePlannerLive` (provided
 *   `ConfigInspectorLive`), and `Changesets.BranchAnalyzerLive`, which shares
 *   the single `ConfigInspectorLive` instance built once via `provideMerge`.
 *
 * The CLI version is injected at build time via `process.env.__PACKAGE_VERSION__`.
 *
 * @internal
 */

import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import {
	BiomeSchemaSyncLive,
	ChangesetConfigLive,
	ChangesetConfigReaderLive,
	Changesets,
	ConfigDiscoveryLive,
	ManagedSectionLive,
	Repos,
	SilkPublishabilityDetectorLive,
	ToolDiscoveryLive,
	VersioningStrategyLive,
} from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";
import {
	PackageManagerDetectorLive,
	PointInTimeWorkspaceLive,
	PublishabilityDetectorLive,
	WorkspaceDiscoveryLive,
	WorkspaceRootLive,
} from "workspaces-effect";

import { changesetCommand } from "../commands/changeset/index.js";
import { checkCommand } from "../commands/check.js";
import { cleanCommand } from "../commands/clean.js";
import { commitCommand } from "../commands/commit/index.js";
import { initCommand } from "../commands/init.js";
import { lintCommand } from "../commands/lint/index.js";
import { reposCommand } from "../commands/repos/index.js";

/* v8 ignore start -- CLI registration; each command tested via exported handler */

/**
 * Root `savvy` command nesting the two orchestrators and three command groups.
 */
const rootCommand = Command.make("savvy").pipe(
	Command.withSubcommands([
		initCommand,
		checkCommand,
		cleanCommand,
		commitCommand,
		changesetCommand,
		lintCommand,
		reposCommand,
	]),
);

const cli = Command.run(rootCommand, {
	name: "savvy",
	version: process.env.__PACKAGE_VERSION__ ?? "0.0.0",
});

/**
 * Shared base layer: workspace services, the changeset config reader, and the
 * leaf silk-effects services that depend only on the platform. Built once and
 * `provideMerge`d so the upper services draw from it AND it stays exposed in the
 * final context for the handlers that yield these tags directly.
 *
 * @remarks
 * The workspace services (`WorkspaceRoot`, `WorkspaceDiscovery`,
 * `PackageManagerDetector`) are wired as a self-contained unit:
 * `WorkspaceDiscoveryLive` is provided `WorkspaceRootLive`, and the bare
 * `WorkspaceRootLive` / `PackageManagerDetectorLive` are exposed for the
 * handlers that yield those tags directly. This mirrors the three source CLIs'
 * minimal workspace wiring rather than pulling in the heavier `WorkspacesLive`
 * (which also forks `DependencyGraph` / `PublishabilityDetector` background work).
 */
const WorkspaceLive = Layer.mergeAll(
	WorkspaceRootLive,
	PackageManagerDetectorLive,
	WorkspaceDiscoveryLive.pipe(Layer.provide(WorkspaceRootLive)),
);

/**
 * Base layer membership: silk-effects leaf services (`ManagedSection`,
 * `BiomeSchemaSync`, `ConfigDiscovery`, `SilkPublishabilityDetector`) that
 * depend only on the platform, plus the changeset base layers
 * (`WorkspaceLive`, `ChangesetConfigReader`) that `AppLive`'s upper services
 * build upon.
 */
const BaseLive = Layer.mergeAll(
	WorkspaceLive,
	ChangesetConfigReaderLive,
	ManagedSectionLive,
	BiomeSchemaSyncLive,
	ConfigDiscoveryLive,
	SilkPublishabilityDetectorLive,
);

/**
 * Merged runtime Layer stack — the union of the three source CLIs' stacks with
 * every inter-layer dependency satisfied.
 *
 * @remarks
 * The upper services depend on members of `BaseLive`:
 * `ToolDiscoveryLive` needs `WorkspaceRoot`, `PackageManagerDetector`, and
 * `CommandExecutor`; `VersioningStrategyLive` needs `ChangesetConfigReader`;
 * `Changesets.ConfigInspectorLive` needs `ChangesetConfigReader`,
 * `WorkspaceDiscovery`, and `FileSystem` (the last for its publishConfig-driven
 * fallback when no explicit `packages` record is configured);
 * `Changesets.BranchAnalyzerLive` needs `ConfigInspector`;
 * `Changesets.ReleasePlannerLive` needs `ConfigInspector`.
 *
 * `ConfigInspectorLive` is built once via {@link Layer.provideMerge}: the merge
 * feeds that single `ConfigInspector` instance into `ReleasePlannerLive` and
 * `BranchAnalyzerLive` AND re-exposes it for the surviving `config validate`
 * handler that yields it directly, so it is never constructed twice per run.
 *
 * `Changesets.DepsRegenLive` (the `deps regen`/`deps detect` orchestration
 * service) needs `ConfigInspector`, `WorkspaceDiscovery` (from
 * `BaseLive`/`InspectorAndAnalyzerLive`), plus `PointInTimeWorkspace` and
 * `PublishabilityDetector` from `workspaces-effect`, and `ChangesetConfig`
 * (provided its own `ChangesetConfigReaderLive`, since `Layer.mergeAll` does
 * not cross-feed sibling layers) — none of which the other commands need, so
 * they're composed only for `DepsRegenGroupLive`. `PointInTimeWorkspaceLive`
 * in turn needs `WorkspaceRoot`, `WorkspaceDiscovery`, `CommandExecutor`,
 * `FileSystem`, `Path` — the workspace pair supplied by `WorkspaceLive`, the
 * platform trio by `NodeContext.layer` below.
 * `DepsRegenGroupLive` reuses the exact `InspectorAndAnalyzerLive` layer
 * reference (not a fresh copy), so Effect's layer memoization builds that
 * single `ConfigInspector` instance once and shares it here too.
 *
 * `provideMerge(BaseLive)` feeds the remaining deps and re-exposes the base
 * services for handlers that yield them directly. `provideMerge(NodeContext.layer)`
 * supplies `FileSystem`, `Path`, and `CommandExecutor` to everything underneath.
 */
const InspectorAndAnalyzerLive = Changesets.BranchAnalyzerLive.pipe(
	Layer.provideMerge(Changesets.ReleasePlannerLive),
	Layer.provideMerge(Changesets.ConfigInspectorLive),
);

/**
 * `Changesets.DepsRegen`, fully composed except for the base services
 * (`WorkspaceDiscovery`, platform layers) supplied by `BaseLive` /
 * `NodeContext.layer`. `PointInTimeWorkspaceLive` is provided `WorkspaceLive`
 * so its `WorkspaceRoot`/`WorkspaceDiscovery` requirements resolve; the
 * remaining `CommandExecutor`/`FileSystem`/`Path` flow up to `NodeContext.layer`.
 */
const DepsRegenGroupLive = Changesets.DepsRegenLive.pipe(
	Layer.provide(InspectorAndAnalyzerLive),
	Layer.provide(PointInTimeWorkspaceLive.pipe(Layer.provide(WorkspaceLive))),
	Layer.provide(PublishabilityDetectorLive),
	Layer.provide(ChangesetConfigLive.pipe(Layer.provide(ChangesetConfigReaderLive))),
);

/**
 * `Repos.ReposManager`, provided its `Repos.ReposConfigStoreLive` dependency.
 * Both draw their platform requirements (`FileSystem`, `Path`,
 * `CommandExecutor`) from `NodeContext.layer` below.
 */
const ReposGroupLive = Repos.ReposManagerLive.pipe(Layer.provide(Repos.ReposConfigStoreLive));

const AppLive = Layer.mergeAll(
	ToolDiscoveryLive,
	VersioningStrategyLive,
	InspectorAndAnalyzerLive,
	DepsRegenGroupLive,
	ReposGroupLive,
).pipe(Layer.provideMerge(BaseLive), Layer.provideMerge(NodeContext.layer));

/**
 * Bootstrap and run the `savvy` CLI application.
 *
 * @remarks
 * Builds an Effect from the parsed `process.argv`, provides the merged layer
 * stack, and hands execution to `NodeRuntime.runMain`.
 *
 * @internal
 */
export function runCli(): void {
	// The command groups are cast to `Command.Command<..., any, any, any>` to
	// dodge declaration-emit errors, so their `any` R-channel leaks here and
	// cannot be narrowed to `never` structurally even though `AppLive` supplies
	// every service. The cast restores the fully-provided shape; the runtime
	// smoke tests — not the type-checker — are the real layer-completeness gate.
	const main = Effect.suspend(() => cli(process.argv)).pipe(Effect.provide(AppLive)) as Effect.Effect<void>;
	NodeRuntime.runMain(main);
}
/* v8 ignore stop */

/**
 * Root `savvy` CLI entry point using `effect/unstable/cli`.
 *
 * @remarks
 * Assembles the five Phase-B command pieces — the `init` and `check` top-level
 * orchestrators plus the `changeset`, `commit`, and `lint` groups — under a
 * single `savvy` root command, then provides the merged runtime Layer stack
 * that satisfies every command's service requirements.
 *
 * The layer stack wires the silk-effects Lives over their v4 requirement
 * channels:
 *
 * - `NodeServices.layer` — `FileSystem`, `Path`, `ChildProcessSpawner`, `Stdio`,
 *   and `Terminal`, consumed by every config reader, workspace service, git
 *   layer, and the CLI framework itself.
 * - `Git.layer` (from `@effected/git`) — the typed git service backing
 *   `BranchAnalyzer`, `ReposManager`, the commit hooks
 *   (`readBranchInfo` / `readSigningDiagnostic`), and `detectGitHubRepo`.
 * - Workspace services from `@effected/workspaces` — `WorkspaceRoot.layer`,
 *   `PackageManagerDetector.layer`, and a single root-bound
 *   `WorkspaceDiscovery.layer()` (the kit resolves the root through
 *   `WorkspaceRoot` from `process.cwd()` lazily on first use, so the CLI's
 *   startup cwd is the discovery root).
 * - Flat silk-effects services — `ChangesetConfigReaderLive`,
 *   `SilkPublishabilityDetectorLive`, `ManagedSectionLive`, `BiomeSchemaSyncLive`,
 *   `ConfigDiscoveryLive`, `ToolDiscoveryLive`, and `VersioningStrategyLive`.
 * - Changesets-namespace services — `Changesets.ConfigInspectorLive`,
 *   `Changesets.ReleasePlannerLive`, and `Changesets.BranchAnalyzerLive`
 *   sharing a single `ConfigInspector` via `provideMerge`. `DepsRegen` is NOT
 *   part of AppLive: its graph is root-bound at layer build, so the deps
 *   commands compose `Changesets.makeDepsRegenDefault({ cwd })` per invocation
 *   against their parsed `--cwd` (platform services flow up to
 *   `NodeServices.layer` here).
 *
 * The CLI version is injected at build time via `process.env.__PACKAGE_VERSION__`.
 *
 * @internal
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Git } from "@effected/git";
import { PackageManagerDetector, WorkspaceDiscovery, WorkspaceRoot } from "@effected/workspaces";
import {
	BiomeSchemaSyncLive,
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
import { Command } from "effect/unstable/cli";

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

/**
 * CLI application: reads argv from the Stdio service provided by NodeServices.
 * (v4's `Command.run` takes only `version` — the name comes from the root command.)
 */
const cli = Command.run(rootCommand, {
	version: process.env.__PACKAGE_VERSION__ ?? "0.0.0",
});

/**
 * Shared workspace services from `@effected/workspaces`, wired as a
 * self-contained unit and built ONCE (layers memoize by reference).
 * `WorkspaceDiscovery.layer()` is root-bound at first use via `WorkspaceRoot`
 * from the CLI's startup cwd — the single-root semantics every downstream
 * consumer (analyzer, deps-regen, publishability) assumes.
 */
const WorkspaceRootLive = WorkspaceRoot.layer;
const WorkspaceDiscoveryLive = WorkspaceDiscovery.layer().pipe(Layer.provide(WorkspaceRootLive));
const WorkspaceLive = Layer.mergeAll(WorkspaceRootLive, PackageManagerDetector.layer, WorkspaceDiscoveryLive);

/**
 * The typed git service, built once over the platform spawner and shared by
 * every git-consuming layer AND exposed to handlers that yield `Git` directly
 * (commit hooks, `detectGitHubRepo`).
 */
const GitLive = Git.layer;

/**
 * Base layer membership: silk-effects leaf services (`ManagedSection`,
 * `BiomeSchemaSync`, `ConfigDiscovery`, `SilkPublishabilityDetector`) that
 * depend only on the platform, plus the changeset base layers
 * (`WorkspaceLive`, `ChangesetConfigReader`, `GitLive`) that `AppLive`'s
 * upper services build upon.
 */
const BaseLive = Layer.mergeAll(
	WorkspaceLive,
	GitLive,
	ChangesetConfigReaderLive,
	ManagedSectionLive,
	BiomeSchemaSyncLive,
	ConfigDiscoveryLive,
	SilkPublishabilityDetectorLive,
);

/**
 * `ConfigInspectorLive` is built once via {@link Layer.provideMerge}: the merge
 * feeds that single `ConfigInspector` instance into `ReleasePlannerLive` and
 * `BranchAnalyzerLive` AND re-exposes it for the surviving `config validate`
 * handler that yields it directly, so it is never constructed twice per run.
 * `BranchAnalyzerLive`'s v4 requirements are `ConfigInspector |
 * ChildProcessSpawner` (the spawner flows up to `NodeServices.layer`).
 */
const InspectorAndAnalyzerLive = Changesets.BranchAnalyzerLive.pipe(
	Layer.provideMerge(Changesets.ReleasePlannerLive),
	Layer.provideMerge(Changesets.ConfigInspectorLive),
);

/**
 * `Repos.ReposManager`, provided its `Repos.ReposConfigStoreLive` dependency
 * and the shared `Git` service. Platform requirements (`FileSystem`, `Path`)
 * flow up to `NodeServices.layer`.
 */
const ReposGroupLive = Repos.ReposManagerLive.pipe(Layer.provide(Repos.ReposConfigStoreLive), Layer.provide(GitLive));

const AppLive = Layer.mergeAll(
	ToolDiscoveryLive,
	VersioningStrategyLive,
	InspectorAndAnalyzerLive,
	ReposGroupLive,
).pipe(Layer.provideMerge(BaseLive), Layer.provideMerge(NodeServices.layer));

/**
 * Bootstrap and run the `savvy` CLI application.
 *
 * @remarks
 * `Command.run` returns an Effect reading `process.argv` from the Stdio
 * service; the merged layer stack is provided and execution handed to
 * `NodeRuntime.runMain`, whose default reporting covers defects (the v3
 * `Cause.defects` wrapper is gone). No type casts: the layer graph is
 * validated by the compiler.
 *
 * @internal
 */
export function runCli(): void {
	NodeRuntime.runMain(cli.pipe(Effect.provide(AppLive)));
}
/* v8 ignore stop */

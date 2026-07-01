/**
 * Composes the long-lived Effect runtime layer for the MCP server.
 *
 * `SilkRuntimeLive` provides {@link SilkWorkspaceAnalyzer} and {@link WorkspaceRoot}.
 * `WorkspaceRoot` lets the server resolve the workspace root by walking up from
 * its launch directory. The layer still requires `FileSystem` + `Path`; the host
 * (bin.ts) supplies them via `NodeContext.layer`.
 *
 * @packageDocumentation
 */

import {
	ChangesetConfigReaderLive,
	Changesets,
	SilkWorkspaceAnalyzerLive,
	TagStrategyLive,
	ToolDiscoveryLive,
	Turbo,
	VersioningStrategyLive,
} from "@savvy-web/silk-effects";
import { Layer } from "effect";
import { WorkspaceRootLive, WorkspacesLive } from "workspaces-effect";

/**
 * The silk-effects dependency set fed to {@link SilkWorkspaceAnalyzerLive}.
 *
 * `WorkspacesLive` supplies the workspace trio plus `DependencyGraph` and
 * `TopologicalSorter` (all required by the analyzer). `VersioningStrategyLive`
 * is provided its own `ChangesetConfigReader` because `Layer.mergeAll` does not
 * cross-feed sibling layers.
 */
const DepsLive = Layer.mergeAll(
	WorkspacesLive,
	ChangesetConfigReaderLive,
	TagStrategyLive,
	VersioningStrategyLive.pipe(Layer.provide(ChangesetConfigReaderLive)),
);

const InspectorAndAnalyzerLive = Changesets.BranchAnalyzerLive.pipe(
	Layer.provideMerge(Changesets.ReleasePlannerLive),
	Layer.provideMerge(Changesets.ConfigInspectorLive),
);

/**
 * `Changesets.DepsRegen` (the `changeset_deps_detect` / `changeset_deps_regen`
 * orchestration service), fully composed except for the services supplied by
 * {@link DepsLive} / the host platform layer.
 *
 * `DepsRegenLive` requires `WorkspaceSnapshotReader | ConfigInspector |
 * WorkspaceDiscovery | CatalogResolver | PublishabilityDetector`. Here
 * `ConfigInspector` is provided via the shared {@link InspectorAndAnalyzerLive}
 * reference (so Effect memoizes the single `ConfigInspector` instance already
 * merged into the runtime), and `WorkspaceSnapshotReader` via the
 * dependency-free {@link Changesets.WorkspaceSnapshotReaderLive}. The remaining
 * three — `WorkspaceDiscovery`, `CatalogResolver`, `PublishabilityDetector` —
 * are left open and satisfied by `WorkspacesLive` inside {@link DepsLive}
 * (unlike the CLI, whose minimal workspace trio has to compose
 * `CatalogResolverLive`/`PublishabilityDetectorLive` by hand). `FileSystem` /
 * `Path` / `CommandExecutor` flow up to the host `NodeContext.layer`.
 */
const DepsRegenGroupLive = Changesets.DepsRegenLive.pipe(
	Layer.provide(InspectorAndAnalyzerLive),
	Layer.provide(Changesets.WorkspaceSnapshotReaderLive),
);

/**
 * The MCP runtime layer. Provides `SilkWorkspaceAnalyzer`, `WorkspaceRoot`,
 * `Turbo.TurboInspector`, `Changesets.BranchAnalyzer`,
 * `Changesets.ConfigInspector`, `Changesets.ReleasePlanner`, and
 * `Changesets.DepsRegen`; requires `CommandExecutor` + `FileSystem` + `Path`
 * from the host's platform layer (`NodeContext.layer` in bin.ts).
 *
 * `TurboInspectorLive` is fed its own `ToolDiscoveryLive`, whose
 * `PackageManagerDetector` + `WorkspaceRoot` requirements are satisfied by
 * {@link DepsLive}; the leftover `CommandExecutor` + `FileSystem` flow up to the
 * host platform layer.
 */
export const SilkRuntimeLive = Layer.mergeAll(
	SilkWorkspaceAnalyzerLive,
	WorkspaceRootLive,
	Turbo.TurboInspectorLive.pipe(Layer.provide(ToolDiscoveryLive)),
	InspectorAndAnalyzerLive,
	DepsRegenGroupLive,
).pipe(Layer.provide(DepsLive));

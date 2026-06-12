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

const InspectorAndAnalyzerLive = Changesets.BranchAnalyzerLive.pipe(Layer.provideMerge(Changesets.ConfigInspectorLive));

/**
 * The MCP runtime layer. Provides `SilkWorkspaceAnalyzer`, `WorkspaceRoot`,
 * `Turbo.TurboInspector`, `Changesets.BranchAnalyzer`, and
 * `Changesets.ConfigInspector`; requires `CommandExecutor` + `FileSystem` +
 * `Path` from the host's platform layer (`NodeContext.layer` in bin.ts).
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
).pipe(Layer.provide(DepsLive));

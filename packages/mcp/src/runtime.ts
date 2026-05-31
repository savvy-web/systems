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
	SilkWorkspaceAnalyzerLive,
	TagStrategyLive,
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

/**
 * The MCP runtime layer. Provides `SilkWorkspaceAnalyzer` and `WorkspaceRoot`;
 * requires `FileSystem` + `Path` from the host's platform layer.
 */
export const SilkRuntimeLive = Layer.mergeAll(SilkWorkspaceAnalyzerLive, WorkspaceRootLive).pipe(
	Layer.provide(DepsLive),
);

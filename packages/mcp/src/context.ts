/**
 * Shared context handed to MCP tool handlers.
 *
 * @packageDocumentation
 */

import type { WorkspaceRoot } from "@effected/workspaces";
import type { Changesets, Repos, SilkWorkspaceAnalyzer, Turbo } from "@savvy-web/silk-effects";
import type { FileSystem, ManagedRuntime, Path } from "effect";

/**
 * Every service the MCP runtime provides to the tool handlers.
 *
 * @remarks
 * `FileSystem.FileSystem | Path.Path` are here so `repos_inspect`'s
 * `gitmodules` mode can read `.gitmodules` through the ambient service
 * (mirroring `Repos.ReposDrift.check`) rather than a bare `node:fs` import —
 * `makeSilkRuntimeLayer` passes both through onto its own output via an
 * `Effect.context` identity layer, so they survive `bin.ts`'s
 * `Layer.provide(NodeServices.layer)` instead of being fully discharged by
 * it.
 */
export type McpServices =
	| SilkWorkspaceAnalyzer
	| WorkspaceRoot
	| Turbo.TurboInspector
	| Changesets.BranchAnalyzer
	| Changesets.ConfigInspector
	| Changesets.ReleasePlanner
	| Changesets.DepsRegen
	| Repos.ReposManager
	| Repos.ReposConfigStore
	| Repos.ReposDrift
	| FileSystem.FileSystem
	| Path.Path;

/** The long-lived runtime and the project working directory. */
export interface McpContext {
	readonly runtime: ManagedRuntime.ManagedRuntime<McpServices, never>;
	readonly cwd: string;
}

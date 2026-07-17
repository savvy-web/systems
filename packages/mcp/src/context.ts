/**
 * Shared context handed to MCP tool handlers.
 *
 * @packageDocumentation
 */

import type { WorkspaceRoot } from "@effected/workspaces";
import type { Changesets, Repos, SilkWorkspaceAnalyzer, Turbo } from "@savvy-web/silk-effects";
import type { ManagedRuntime } from "effect";

/** Every service the MCP runtime provides to the tool handlers. */
export type McpServices =
	| SilkWorkspaceAnalyzer
	| WorkspaceRoot
	| Turbo.TurboInspector
	| Changesets.BranchAnalyzer
	| Changesets.ConfigInspector
	| Changesets.ReleasePlanner
	| Changesets.DepsRegen
	| Repos.ReposManager
	| Repos.ReposConfigStore;

/** The long-lived runtime and the project working directory. */
export interface McpContext {
	readonly runtime: ManagedRuntime.ManagedRuntime<McpServices, never>;
	readonly cwd: string;
}

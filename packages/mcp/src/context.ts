/**
 * Shared context handed to MCP tool handlers.
 *
 * @packageDocumentation
 */

import type { Changesets, SilkWorkspaceAnalyzer, Turbo } from "@savvy-web/silk-effects";
import type { ManagedRuntime } from "effect";
import type { WorkspaceDiscoveryError, WorkspaceRoot } from "workspaces-effect";

/** The long-lived runtime and the project working directory. */
export interface McpContext {
	readonly runtime: ManagedRuntime.ManagedRuntime<
		| SilkWorkspaceAnalyzer
		| WorkspaceRoot
		| Turbo.TurboInspector
		| Changesets.BranchAnalyzer
		| Changesets.ConfigInspector
		| Changesets.ReleasePlanner,
		WorkspaceDiscoveryError
	>;
	readonly cwd: string;
}

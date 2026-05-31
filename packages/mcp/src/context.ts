/**
 * Shared context handed to MCP tool handlers.
 *
 * @packageDocumentation
 */

import type { SilkWorkspaceAnalyzer } from "@savvy-web/silk-effects";
import type { ManagedRuntime } from "effect";
import type { WorkspaceDiscoveryError, WorkspaceRoot } from "workspaces-effect";

/** The long-lived runtime + the project working directory. */
export interface McpContext {
	readonly runtime: ManagedRuntime.ManagedRuntime<SilkWorkspaceAnalyzer | WorkspaceRoot, WorkspaceDiscoveryError>;
	readonly cwd: string;
}

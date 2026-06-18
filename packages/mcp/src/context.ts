/**
 * Shared context handed to MCP tool handlers.
 *
 * @packageDocumentation
 */

import type { Changesets, SilkWorkspaceAnalyzer, Turbo } from "@savvy-web/silk-effects";
import type { ManagedRuntime } from "effect";
import type { WorkspaceDiscoveryError, WorkspaceRoot } from "workspaces-effect";

import type { DocIndex } from "./resources/doc-index.js";
import type { Manifest } from "./resources/schema.js";

/** The long-lived runtime, the project working directory, and the resource layer. */
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
	readonly docIndex: DocIndex;
	readonly manifest: Manifest;
	readonly contentRoot: string;
}

/**
 * Shared wiring for `@effected/mcp/testing`'s `McpHarness` over the real
 * `ServerLayer(cwd)`: the platform services the server needs, minus `Stdio`,
 * which the harness supplies as queue-backed stdio.
 */

import { NodeChildProcessSpawner, NodeFileSystem, NodePath } from "@effect/platform-node";
import type { McpHarnessOptions } from "@effected/mcp/testing";
import { McpHarness } from "@effected/mcp/testing";
import { Layer } from "effect";

import type { PlatformServices } from "../../src/server.js";
import { ServerLayer } from "../../src/server.js";

/**
 * `PlatformServices` minus `Stdio`: `NodeServices.layer` carries its own
 * `Stdio`, which would win over the harness's queue-backed one and hang every
 * wait. Mirrors how `NodeServices.layer` itself builds the spawner over the
 * filesystem and path.
 */
export const PlatformWithoutStdio = NodeChildProcessSpawner.layer.pipe(
	Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
);

/**
 * An `McpHarness` over `ServerLayer(cwd)` (or a fixture layer built the same
 * way: `McpToolkit.layer` over `McpStdio.layer`), with the platform provided.
 */
export const makeHarness = (
	cwd: string,
	options: McpHarnessOptions & {
		readonly serverLayer?: Layer.Layer<never, never, PlatformServices> | undefined;
	} = {},
) => {
	const { serverLayer = ServerLayer(cwd), ...harnessOptions } = options;
	return McpHarness.make(serverLayer.pipe(Layer.provide(PlatformWithoutStdio)), harnessOptions);
};

/** One entry of a `tools/call` result. */
export interface CallToolResult {
	readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
	readonly structuredContent?: unknown;
	readonly isError?: boolean;
}

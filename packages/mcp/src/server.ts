/**
 * The savvy-mcp server as ONE layer over `effect/unstable/ai`'s `McpServer`:
 * the ten-tool toolkit registered against the stdio transport, with the
 * silk-effects service graph discharging every handler's dependencies.
 *
 * @remarks
 * ## Era-agnostic constraints
 *
 * Every tool obeys these so a future protocol bump is a one-line `protocols`
 * change in {@link ServerLayer}:
 *
 * - no `initialize`-time state beyond what the framework keeps internally
 * - no server-initiated requests
 * - no reliance on sessions
 * - paging carried in tool arguments (`limit` / `offset`), never a
 *   protocol-level cursor
 * - every tool a pure request/response — no streaming, no elicitation
 *
 * These constraints are what let the server offer the stateless
 * `2026-07-28` protocol (SEP-2575): no handshake, no session, every request
 * self-contained.
 *
 * ## The six gotchas, verified against effect@4.0.0-rc.117
 *
 * (Source paths are under `.repos/effect/packages/effect/src/`.)
 *
 * 1. **`Tool.make` needs an explicit `dependencies` array.** `Tool.make`'s
 *    `Dependencies` type parameter defaults to `[]`, so
 *    `Tool.HandlerServices` infers `never` and a handler that yields a
 *    service fails `Toolkit.HandlersFrom`. Every tool here declares the
 *    services its handler yields; `biome_check` yields none and declares
 *    none.
 * 2. **`protocols` order is load-bearing.** The runtime
 *    (`unstable/ai/internal/mcpRuntime.ts`) routes a request that carries
 *    `_meta["io.modelcontextprotocol/protocolVersion"]` to that adapter,
 *    matches an `initialize` against the STATEFUL adapters only, and sends
 *    anything else with no session to `protocols[0]`. At most one stateless
 *    adapter is allowed. This server lists the stateless `2026-07-28`
 *    adapter first, then the newest two stateful ones, because every
 *    shipping client (Claude Code's default stdio session, Copilot, Cursor,
 *    the Inspector) still opens with `initialize`, which a server offering
 *    ONLY `2026-07-28` answers with `METHOD_NOT_FOUND`. Never drop the
 *    stateful adapters. `@effected/mcp`'s `McpStdio.protocols` — the
 *    default {@link ServerLayer} serves — is exactly this list.
 * 3. **A declared typed failure reaches the wire as message text only.**
 *    Under `failureMode: "error"` (the only mode these tools use) core's
 *    `registerToolkit` collapses an `Error`-shaped declared failure to
 *    `{ isError: true, content: [{ type: "text", text: error.message }] }`
 *    with no `structuredContent` (`McpServer.ts`, `declaredFailureResult`).
 *    So `errors.ts` composes every member's `message` at construction with
 *    `ToolFailure.message` and truncates echoed caller values. A declared
 *    failure is not logged: it is a result the model reads, not an incident.
 * 4. **Every log line must reach stderr, never stdout.** Handled by the kit:
 *    `McpStdio.layer` merges `References.LogToStderr` into its output and
 *    `McpStdio.launch` provides it around the whole program, so an internal
 *    failure's log and a launch failure both stay off the JSON-RPC wire.
 * 5. **A clean stdin close exits 130 by default.** Handled by the kit:
 *    `main.ts` passes `McpStdio.teardown`, which maps stdin EOF to exit 0.
 *    Corollary: a `tools/call` still in flight when stdin closes is
 *    interrupted, its response never written, and the exit is STILL 0; the
 *    e2e suite therefore reads a call's response before closing stdin.
 * 6. **A resource URI template's parametric segment cannot span a `/`.**
 *    Not exercised: this server registers no resources (tools only). Left
 *    on record for the day one is added — register static per-item
 *    resources at boot rather than a nested-id template.
 *
 * ## Registration, and the text channel
 *
 * The toolkit is registered by `@effected/mcp`'s `McpToolkit.layer`, which is
 * core's `registerToolkit` plus a better unknown-argument report for strict
 * tools. A success is rendered by core: `structuredContent` is the encoded
 * result and `content[0].text` is the same object as JSON. That is the whole
 * contract, deliberately: Claude Code forwards only `structuredContent` to
 * the model when a result carries one (systems#688), so a separate markdown
 * transcript in the text channel reached no model and was retired along with
 * the port of `registerToolkit` that carried it.
 *
 * `strict: "annotated"` with no tool annotated `Tool.Strict` keeps every
 * tool lenient: Claude Code sends `_meta`-style extras on some calls, so
 * strictness is a per-tool opt-in.
 *
 * `outputSchema` is served only for an object-rooted success schema (core
 * since rc.117). Four tools' results are discriminated unions
 * (`turbo_inspect`, `changeset_inspect`, `repos_inspect`, `repos_manage`),
 * whose JSON Schema is `anyOf`-rooted, so they serve no `outputSchema`;
 * their `structuredContent` is unaffected.
 *
 * @packageDocumentation
 */

import type { Distribution } from "@effected/engine";
import { distributionSuffix } from "@effected/engine";
import { McpStdio, McpToolkit } from "@effected/mcp";
import type { FileSystem, Path, Stdio } from "effect";
import { Layer, Option } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

import { makeSilkRuntimeLayer } from "./runtime.js";
import { SilkToolkit, ToolsLayer } from "./toolkit.js";
import { CURRENT_MCP_VERSION } from "./version.js";

/**
 * Everything {@link ServerLayer} still needs from the platform: the three
 * services `makeSilkRuntimeLayer` requires, plus `Stdio`, which
 * `McpStdio.layer` itself requires. `NodeServices.layer` supplies all
 * four in `main.ts`; tests swap `Stdio` for `Stdio.layerTest`.
 *
 * @public
 */
export type PlatformServices =
	| FileSystem.FileSystem
	| Path.Path
	| ChildProcessSpawner.ChildProcessSpawner
	| Stdio.Stdio;

/**
 * The agent-facing orientation every client receives: in the `initialize`
 * result on the stateful protocols and in the `server/discover` result on
 * `2026-07-28`. Says what the server is for, which tool to reach for first,
 * and the traps; the one-line human summary stays in `description`.
 *
 * @public
 */
export const SERVER_INSTRUCTIONS = [
	"savvy-mcp serves ten structured tools over a Silk Suite workspace: a pnpm + Turborepo monorepo on @savvy-web/silk.",
	"Reach for the matching tool before reconstructing an answer from shell output or memory; each encodes the repo's package boundaries, conventions and exclusion rules.",
	"workspace_info: layout, package names, publish and version state; the default for any structural fact about the repo.",
	"turbo_inspect: cache, graph and affected-package inspection; read-only, never runs tasks.",
	"biome_check: structured Biome diagnostics and the ONLY sanctioned route for a Biome fix pass (write/unsafe); a direct Biome invocation skips the repo config and can corrupt vendored trees under .repos/.",
	"changeset_inspect, changeset_validate, changeset_preview: the branch diff by owning package, typed CSH001-CSH005 diagnostics, and the CHANGELOG the pending changesets would produce.",
	"changeset_deps_detect (reads) and changeset_deps_regen (deletes and recreates) dependency changesets.",
	"repos_inspect (reads) and repos_manage (mutates) the vendored reference repos under .repos/; repos_manage restore discards uncommitted worktree edits.",
	"Every successful result is a typed object in structuredContent (content[0].text carries the same object as JSON). A failure is an isError result whose content[0].text carries the message and remediation, with no structuredContent. Every tool takes an optional cwd; omit it to use the server's project directory.",
].join("\n");

/**
 * The toolkit registration as a layer: `McpToolkit.layer` over core's
 * module-level `McpServer.McpServer.layer` — the same reference
 * `McpStdio.layer` serves, so layer memoization lands the registration on the
 * served instance — with the handlers bound to `cwd`.
 */
const SilkToolsLayer = (cwd: string) =>
	McpToolkit.layer(SilkToolkit, { strict: "annotated" }).pipe(Layer.provide(ToolsLayer(cwd)));

/**
 * Options for {@link ServerLayer}.
 *
 * @public
 */
export interface ServerOptions {
	/**
	 * The carrier this server was installed through (for example
	 * `@savvy-web/silk`), rendered into `serverInfo.version` as
	 * `" via <name> <version>"`. Absent for a direct install.
	 */
	readonly distribution?: Distribution | undefined;
}

/**
 * The whole server as one layer: the ten-tool toolkit, the silk-effects
 * runtime discharging its dependencies, over `@effected/mcp`'s
 * `McpStdio.layer`.
 *
 * `McpStdio.layer` is `McpServer.layerStdio` with the kit's default
 * `protocols` (the stateless `2026-07-28` adapter first, then the two newest
 * stateful ones — see gotcha 2), `LogToStderr` merged into its output, a
 * stdin guard answering a non-JSON line with `-32700`, and `Layer.orDie`.
 *
 * @public
 */
export const ServerLayer = (cwd: string, options: ServerOptions = {}): Layer.Layer<never, never, PlatformServices> =>
	SilkToolsLayer(cwd).pipe(
		Layer.provide(makeSilkRuntimeLayer(cwd)),
		Layer.provide(
			McpStdio.layer({
				name: "savvy-mcp",
				version: `${CURRENT_MCP_VERSION}${distributionSuffix(Option.fromNullishOr(options.distribution))}`,
				description: "Structured Silk Suite workspace tools: workspace, turbo, biome, changesets and vendored repos.",
				instructions: SERVER_INSTRUCTIONS,
			}),
		),
	);

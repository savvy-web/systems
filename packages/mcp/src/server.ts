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
 * ## The six gotchas, verified against effect@4.0.0-rc.115
 *
 * (Source paths are under `.repos/effect/packages/effect/src/`.)
 *
 * 1. **`Tool.make` needs an explicit `dependencies` array.** Still true.
 *    `Tool.make`'s `Dependencies` type parameter defaults to `[]`, so
 *    `Tool.HandlerServices` infers `never` (`unstable/ai/Tool.ts:1200-1265`)
 *    and a handler that yields a service fails `Toolkit.HandlersFrom`
 *    (`unstable/ai/Toolkit.ts:172-182`). Every tool here declares the
 *    services its handler yields; `biome_check` yields none and declares
 *    none.
 * 2. **`protocols` order is load-bearing.** Still true: the stdio
 *    serialization selects `protocols.find(version === offered) ??
 *    protocols[0]` on `initialize` (`unstable/ai/McpServer.ts:1268-1271`),
 *    so an unrecognised client version negotiates to `protocols[0]`. rc.115
 *    exports four adapters (`McpProtocol.v2025_11_25`, `v2025_06_18`,
 *    `v2025_03_26`, `v2024_11_05`; `unstable/ai/McpProtocol.ts:101-146`);
 *    this server lists the newest two, newest first. Never reduce it to one.
 * 3. **A declared typed failure reaches the wire as message text only.**
 *    Still true: `registerToolkit` collapses a caught declared failure to
 *    `{ isError: true, content: [{ type: "text", text: error.message }] }`
 *    (`McpServer.ts:1513-1517,1603-1607`) and never sets
 *    `structuredContent` for it. The custom registration below mirrors that
 *    exactly, so `errors.ts` composes every member's `message` at
 *    construction and truncates echoed caller values.
 * 4. **`Logger.consolePretty`'s `stderr` option is inert.** Still true, and
 *    the option is not even in the signature any more — rc.115 reads only
 *    `{ colors, formatDate, mode }` (`internal/effect.ts:6647-6651`). The
 *    real switch is `Logger.LogToStderr`, read at log time
 *    (`internal/effect.ts:6688,6832`: `fiber.getRef(LogToStderr) ?
 *    console.error : console.log`); `main.ts` provides it. Without it every
 *    log line — and `registerToolkit` logs every failing call at error level
 *    (`McpServer.ts:1587`) — lands on stdout, the JSON-RPC wire.
 * 5. **A clean stdin close exits 130 by default.** Still true:
 *    `Runtime.defaultTeardown` returns 130 when the main fiber's cause has
 *    interrupts only (`Runtime.ts:108-114`), which is what stdin EOF ending
 *    `layerStdio`'s scope produces. `main.ts` passes `NodeRuntime.runMain`'s
 *    `teardown` option (`@effect/platform-node` `NodeRuntime.d.ts`) mapping
 *    success-or-interrupts-only to 0 and deferring the rest to the default.
 *    Corollary: a `tools/call` still in flight when stdin closes is
 *    interrupted, its response never written, and the exit is STILL 0 —
 *    interrupts-only cannot distinguish the two. A client that pipes a
 *    request and immediately hits EOF gets no answer and no non-zero exit;
 *    the e2e helper therefore reads a call's response before closing stdin.
 * 6. **A resource URI template's parametric segment cannot span a `/`.**
 *    Not exercised: this server registers no resources (tools only). Left
 *    on record for the day one is added — register static per-item
 *    resources at boot rather than a nested-id template.
 *
 * ## The dual channel, and why registration is custom
 *
 * rc.115's `McpServer.registerToolkit` renders every success as
 * `content: [{ type: "text", text: JSON.stringify(encodedResult) }]` plus
 * `structuredContent` (`McpServer.ts:1577-1585`) and offers no hook over the
 * text. Every tool description promises "markdown in content[] and a typed
 * object in structuredContent", so {@link registerSilkToolkit} registers the
 * toolkit through the public `McpServer.addTool` instead: identical
 * schema/annotation/error handling to `registerToolkit`, with the text
 * channel taken from each tool's {@link SilkMarkdown} annotation. The success
 * schemas stay the shared silk-effects definitions, untouched. If a future rc
 * exposes a text renderer on `registerToolkit`, delete the custom function
 * and use `McpServer.toolkit(SilkToolkit)`.
 *
 * Baseline for the next rc bump — the three places this mirror knowingly
 * deviates from rc.115's `registerToolkit`, to re-check against the new
 * source: (i) the success branch renders the `SilkMarkdown` annotation as
 * `content[0].text` instead of `JSON.stringify(encodedResult)`; (ii) the
 * success JSON Schema is passed through {@link hoistRootRef} before the
 * `type === "object"` check (the framework drops `outputSchema` for any
 * `$ref`-rooted document); (iii) the mirror always emits one text item,
 * whereas the framework emits `content: []` when the encoded result is
 * `undefined` (a `Schema.Void` success) — moot here, every tool has an
 * object result. Everything else — description via `Tool.getDescription`,
 * `Tool.Meta` → `_meta`, annotation lifting, the `catchCause` ladder — is a
 * verbatim mirror and must stay one.
 *
 * `outputSchema` is served only when the success schema's JSON Schema is
 * object-rooted (`McpSchema.ToolJsonSchema` requires `type: "object"`;
 * `McpServer.ts:1548-1551`). Four tools' results are discriminated unions
 * (`turbo_inspect`, `changeset_inspect`, `repos_inspect`, `repos_manage`),
 * whose JSON Schema is `anyOf`-rooted, so they serve no `outputSchema`;
 * their `structuredContent` is unaffected.
 *
 * @packageDocumentation
 */

import type { FileSystem, Path, Stdio } from "effect";
import { Cause, Context, Effect, ErrorReporter, Layer, Option, Result, Schema, Sink, Stream } from "effect";
import type { Toolkit } from "effect/unstable/ai";
import { AiError, McpProtocol, McpSchema, McpServer, Tool } from "effect/unstable/ai";
import type { ChildProcessSpawner } from "effect/unstable/process";

import { SilkMarkdown } from "./markdown.js";
import { makeSilkRuntimeLayer } from "./runtime.js";
import { SilkToolkit, ToolsLayer } from "./toolkit.js";
import { CURRENT_MCP_VERSION } from "./version.js";

/**
 * Everything {@link ServerLayer} still needs from the platform: the three
 * services `makeSilkRuntimeLayer` requires, plus `Stdio`, which
 * `McpServer.layerStdio` itself requires (`McpServer.ts:1217-1225`).
 * `NodeServices.layer` supplies all four in `main.ts`; tests swap `Stdio`
 * for `Stdio.layerTest`.
 *
 * @public
 */
export type PlatformServices =
	| FileSystem.FileSystem
	| Path.Path
	| ChildProcessSpawner.ChildProcessSpawner
	| Stdio.Stdio;

const INTERNAL_TOOL_ERROR_MESSAGE = "Tool execution failed due to an internal server error.";

const toolErrorResult = (message: string): McpSchema.CallToolResult =>
	new McpSchema.CallToolResult({ isError: true, content: [{ type: "text", text: message }] });

/**
 * Hoist a `$ref`-rooted JSON Schema document onto its referenced definition.
 * `Schema.toJsonSchemaDocument` emits `{ $ref: "#/$defs/<id>", $defs }` for
 * any schema annotated with an `identifier` — every result schema here is —
 * and `McpSchema.ToolJsonSchema` needs a `type: "object"` root, so without
 * this no tool would serve an `outputSchema` (rc.115's own `registerToolkit`
 * has the same blind spot). The definitions stay attached for nested refs.
 */
const hoistRootRef = (schema: Record<string, unknown>): Record<string, unknown> => {
	const ref = schema.$ref;
	const defs = schema.$defs;
	if (typeof ref !== "string" || !ref.startsWith("#/$defs/") || typeof defs !== "object" || defs === null) {
		return schema;
	}
	const target = (defs as Record<string, unknown>)[ref.slice("#/$defs/".length)];
	if (typeof target !== "object" || target === null) return schema;
	const { $ref: _ref, ...rest } = schema;
	return { ...rest, ...(target as Record<string, unknown>), $defs: defs };
};

/** MCP models `structuredContent` as a JSON object, so a `null` or array encoded result is omitted. */
const toStructuredContent = (value: unknown): Schema.JsonObject | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Schema.JsonObject) : undefined;

/**
 * Register a toolkit with the running `McpServer`, rendering each success as
 * the tool's markdown transcript in `content[0].text` and the encoded result
 * in `structuredContent`. A port of rc.115's `McpServer.registerToolkit`
 * (`McpServer.ts:1525-1611`) that differs in the success branch only.
 *
 * @remarks
 * `Effect.context<never>()` captures the registration-time services (the
 * handlers' declared dependencies, discharged by the runtime layer) so each
 * call runs against them; `McpServerClient` is provided per call by the
 * framework and is the one service excluded from that capture.
 */
const registerSilkToolkit = <Tools extends Record<string, Tool.Any>>(
	toolkit: Toolkit.Toolkit<Tools>,
): Effect.Effect<
	void,
	never,
	McpServer.McpServer | Tool.HandlersFor<Tools> | Exclude<Tool.HandlerServices<Tools>, McpSchema.McpServerClient>
> =>
	Effect.gen(function* () {
		const registry = yield* McpServer.McpServer;
		const built = yield* toolkit;
		const services = yield* Effect.context<never>();
		const reportCause = (cause: Cause.Cause<unknown>) => Effect.provideContext(ErrorReporter.report(cause), services);
		for (const tool of Object.values(built.tools) as ReadonlyArray<Tool.Any>) {
			const annotations = tool.annotations;
			const renderMarkdown = Context.getOrUndefined(annotations, SilkMarkdown);
			const isDeclaredFailure = Schema.is(tool.failureSchema);
			const outputJsonSchema = hoistRootRef(
				Tool.getJsonSchemaFromSchema(tool.successSchema) as Record<string, unknown>,
			);
			const outputSchema =
				outputJsonSchema.type === "object"
					? yield* Schema.decodeUnknownEffect(McpSchema.ToolJsonSchema)(outputJsonSchema).pipe(Effect.orDie)
					: undefined;
			const inputSchema = yield* Schema.decodeUnknownEffect(McpSchema.ToolJsonSchema)(Tool.getJsonSchema(tool)).pipe(
				Effect.orDie,
			);
			const toolMeta = Context.getOrUndefined(annotations, Tool.Meta);
			const description = Tool.getDescription(tool);
			const mcpTool = new McpSchema.Tool({
				name: tool.name,
				...(description === undefined ? {} : { description }),
				inputSchema,
				...(outputSchema === undefined ? {} : { outputSchema }),
				annotations: {
					...Context.getOption(annotations, Tool.Title).pipe(
						Option.map((title) => ({ title })),
						Option.getOrUndefined,
					),
					readOnlyHint: Context.get(annotations, Tool.Readonly),
					destructiveHint: Context.get(annotations, Tool.Destructive),
					idempotentHint: Context.get(annotations, Tool.Idempotent),
					openWorldHint: Context.get(annotations, Tool.OpenWorld),
				},
				...(toolMeta === undefined ? {} : { _meta: toolMeta as Schema.JsonObject }),
			});
			yield* registry.addTool({
				tool: mcpTool,
				annotations,
				handle: (payload: unknown) =>
					built.handle(tool.name as keyof Tools, (payload ?? {}) as never).pipe(
						Stream.unwrap,
						Stream.run(Sink.last()),
						Effect.flatMap(Effect.fromOption),
						Effect.map(
							(result) =>
								new McpSchema.CallToolResult({
									isError: false,
									structuredContent: toStructuredContent(result.encodedResult),
									content: [
										{
											type: "text",
											text:
												renderMarkdown === undefined
													? JSON.stringify(result.encodedResult)
													: renderMarkdown(result.result),
										},
									],
								}),
						),
						Effect.provideContext(services as Context.Context<Tool.HandlerServices<Tools[keyof Tools]>>),
						Effect.tapCause(Effect.logError),
						Effect.catchCause((cause) => {
							const failure = Cause.findError(cause);
							if (Result.isFailure(failure)) {
								return Cause.hasDies(cause)
									? Effect.as(reportCause(cause), toolErrorResult(INTERNAL_TOOL_ERROR_MESSAGE))
									: Effect.failCause(failure.failure);
							}
							const error: unknown = failure.success;
							if (AiError.isAiError(error)) {
								const reason = error.reason;
								return reason._tag === "ToolParameterValidationError"
									? Effect.fail(new McpSchema.InvalidParams({ message: reason.message }))
									: Effect.as(reportCause(cause), toolErrorResult(INTERNAL_TOOL_ERROR_MESSAGE));
							}
							const message =
								isDeclaredFailure(error) && error instanceof Error ? error.message : INTERNAL_TOOL_ERROR_MESSAGE;
							return Effect.as(reportCause(cause), toolErrorResult(message));
						}),
					),
			});
		}
	});

/**
 * The toolkit registration as a layer: {@link registerSilkToolkit} over
 * `McpServer.layer` (the same reference `McpServer.layerStdio` merges, so
 * layer memoization lands the registration on the served instance), with the
 * handlers bound to `cwd`.
 */
const SilkToolsLayer = (cwd: string) =>
	Layer.effectDiscard(registerSilkToolkit(SilkToolkit)).pipe(
		Layer.provide(McpServer.McpServer.layer),
		Layer.provide(ToolsLayer(cwd)),
	);

/**
 * The whole server as one layer: the ten-tool toolkit, the silk-effects
 * runtime discharging its dependencies, over `McpServer.layerStdio`.
 *
 * `protocols` lists the newest two adapters, newest first — see gotcha 2 in
 * the module remarks. `Cause.IllegalArgumentError` in `layerStdio`'s error
 * channel is `orDie`d: `protocols` is a static two-element literal, so it is
 * an implementer-time defect, not a runtime condition.
 *
 * @public
 */
export const ServerLayer = (cwd: string): Layer.Layer<never, never, PlatformServices> =>
	SilkToolsLayer(cwd).pipe(
		Layer.provide(makeSilkRuntimeLayer(cwd)),
		Layer.provide(
			McpServer.layerStdio({
				name: "savvy-mcp",
				version: CURRENT_MCP_VERSION,
				protocols: [McpProtocol.v2025_11_25, McpProtocol.v2025_06_18],
			}),
		),
		Layer.orDie,
	);

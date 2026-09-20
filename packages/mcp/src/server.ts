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
 * ## The six gotchas, verified against effect@4.0.0-rc.116
 *
 * (Source paths are under `.repos/effect/packages/effect/src/`.)
 *
 * 1. **`Tool.make` needs an explicit `dependencies` array.** Still true.
 *    `Tool.make`'s `Dependencies` type parameter defaults to `[]`, so
 *    `Tool.HandlerServices` infers `never` and a handler that yields a
 *    service fails `Toolkit.HandlersFrom`. Every tool here declares the
 *    services its handler yields; `biome_check` yields none and declares
 *    none.
 * 2. **`protocols` order is load-bearing.** More so in rc.116: the runtime
 *    (`unstable/ai/internal/mcpRuntime.ts`) routes a request that carries
 *    `_meta["io.modelcontextprotocol/protocolVersion"]` to that adapter,
 *    matches an `initialize` against the STATEFUL adapters only, and sends
 *    anything else with no session to `protocols[0]`. At most one stateless
 *    adapter is allowed (a second fails the layer with
 *    `Cause.IllegalArgumentError`). rc.116 exports five adapters
 *    (`McpProtocol.v2026_07_28` — stateless — then `v2025_11_25`,
 *    `v2025_06_18`, `v2025_03_26`, `v2024_11_05`); this server lists the
 *    stateless one first, then the newest two stateful ones, because every
 *    shipping client (Claude Code's default stdio session, Copilot, Cursor,
 *    the Inspector) still opens with `initialize`, which a server offering
 *    ONLY `2026-07-28` answers with `METHOD_NOT_FOUND`. Never drop the
 *    stateful adapters.
 * 3. **A declared typed failure reaches the wire as message text only.**
 *    Still true under `failureMode: "error"` (the only mode these tools
 *    use): `Toolkit.handle` fails the stream with a `Cause` annotated
 *    `Toolkit.FailureOrigin = "handler"`, and `registerToolkit` collapses an
 *    `Error`-shaped declared failure to
 *    `{ isError: true, content: [{ type: "text", text: error.message }] }`
 *    with no `structuredContent` (`McpServer.ts`, `declaredFailureResult`).
 *    The custom registration below mirrors that exactly, so `errors.ts`
 *    composes every member's `message` at construction and truncates echoed
 *    caller values.
 * 4. **`Logger.consolePretty`'s `stderr` option is inert.** Still true; the
 *    real switch is `Logger.LogToStderr`, read at log time, which `main.ts`
 *    provides. Without it every log line — and `registerToolkit` logs every
 *    failing call at error level — lands on stdout, the JSON-RPC wire.
 * 5. **A clean stdin close exits 130 by default.** Still true:
 *    `Runtime.defaultTeardown` returns 130 when the main fiber's cause has
 *    interrupts only, which is what stdin EOF ending `layerStdio`'s scope
 *    produces. `main.ts` passes `NodeRuntime.runMain`'s `teardown` option
 *    mapping success-or-interrupts-only to 0 and deferring the rest to the
 *    default. Corollary: a `tools/call` still in flight when stdin closes is
 *    interrupted, its response never written, and the exit is STILL 0; the
 *    e2e helper therefore reads a call's response before closing stdin.
 * 6. **A resource URI template's parametric segment cannot span a `/`.**
 *    Not exercised: this server registers no resources (tools only). Left
 *    on record for the day one is added — register static per-item
 *    resources at boot rather than a nested-id template.
 *
 * ## The dual channel, and why registration is custom
 *
 * rc.116's `McpServer.registerToolkit` renders every success as
 * `content: [{ type: "text", text: JSON.stringify(encodedResult) }]` plus
 * `structuredContent` and offers no hook over the text. Every tool
 * description promises "markdown in content[] and a typed object in
 * structuredContent", so {@link registerSilkToolkit} registers the toolkit
 * through the public `McpServer.addTool` instead: identical
 * schema/annotation/error handling to `registerToolkit`, with the text
 * channel taken from each tool's {@link SilkMarkdown} annotation. The success
 * schemas stay the shared silk-effects definitions, untouched. If a future rc
 * exposes a text renderer on `registerToolkit`, delete the custom function
 * and use `McpServer.toolkit(SilkToolkit)`.
 *
 * Baseline for the next rc bump — the places this mirror knowingly deviates
 * from rc.116's `registerToolkit` (`McpServer.ts`, `export const
 * registerToolkit`), to re-check against the new source: (i) the success
 * branch renders the `SilkMarkdown` annotation as `content[0].text` instead
 * of `JSON.stringify(encodedResult)`; (ii) `outputSchema` is served only
 * when the success JSON Schema, after {@link hoistRootRef}, is
 * object-rooted — rc.116 relaxed `McpSchema.ToolOutputJson` to any JSON
 * object and serves every document verbatim, but the MCP TypeScript SDK's
 * `ToolSchema` still requires `outputSchema.type === "object"`, so an
 * `anyOf`-rooted document would break `tools/list` in strict clients;
 * (iii) the mirror always emits one text item, whereas the framework emits
 * `content: []` when the encoded result is `undefined` (a `Schema.Void`
 * success) — moot here, every tool has an object result; (iv) a declared
 * failure is still logged at error level before it is rendered — rc.116's
 * `registerToolkit` logs only internal failures, but the e2e lifecycle suite
 * pins the stderr routing of gotcha 4 through a declared failure, and a
 * dependency bump is not the place to change what operators see. Everything
 * else — description via `Tool.getDescription`, `Tool.Meta` → `_meta`,
 * annotation lifting, the `omitRequestServices` capture, the `FailureOrigin`
 * ladder, the `Tool.Strict` handling (strict decode, `additionalProperties:
 * false` on the served input schema, a die for a strict dynamic tool) — is a
 * verbatim mirror and must stay one. No tool here is strict today: Claude
 * Code sends `_meta`-style extras on some calls, so strict is a per-tool
 * decision.
 *
 * Four tools' results are discriminated unions (`turbo_inspect`,
 * `changeset_inspect`, `repos_inspect`, `repos_manage`), whose JSON Schema
 * is `anyOf`-rooted, so they serve no `outputSchema`; their
 * `structuredContent` is unaffected.
 *
 * @packageDocumentation
 */

import type { FileSystem, Path, SchemaAST, Stdio } from "effect";
import { Cause, Context, Effect, ErrorReporter, Layer, Option, Result, Schema, Stream } from "effect";
import { CurrentLogLevel } from "effect/References";
import { AiError, McpProtocol, McpSchema, McpServer, Tool, Toolkit } from "effect/unstable/ai";
import { HttpServerRequest } from "effect/unstable/http";
import type { ChildProcessSpawner } from "effect/unstable/process";

import { SilkMarkdown } from "./markdown.js";
import { makeSilkRuntimeLayer } from "./runtime.js";
import { SilkToolkit, ToolsLayer } from "./toolkit.js";
import { CURRENT_MCP_VERSION } from "./version.js";

/**
 * Everything {@link ServerLayer} still needs from the platform: the three
 * services `makeSilkRuntimeLayer` requires, plus `Stdio`, which
 * `McpServer.layerStdio` itself requires. `NodeServices.layer` supplies all
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
	"Every successful result carries a markdown transcript in content[0].text and the typed object in structuredContent; read structuredContent when you need fields. A failure is an isError result whose content[0].text carries the message and remediation, with no structuredContent. Every tool takes an optional cwd; omit it to use the server's project directory.",
].join("\n");

const INTERNAL_TOOL_ERROR_MESSAGE = "Tool execution failed due to an internal server error.";

const toolErrorResult = (message: string): McpSchema.CallToolResult =>
	new McpSchema.CallToolResult({ isError: true, content: [{ type: "text", text: message }] });

const toolResultContent = (encoded: unknown): McpSchema.CallToolResult["content"] =>
	encoded === undefined ? [] : [{ type: "text", text: JSON.stringify(encoded) }];

// Request services must come from the invocation, including when a handler is registered during a request.
const omitRequestServices = Context.omit(
	McpSchema.McpRequestContext,
	McpSchema.McpServerClient,
	HttpServerRequest.HttpServerRequest,
	CurrentLogLevel,
);

const isParameterValidationError = (
	error: unknown,
): error is AiError.AiError & { readonly reason: AiError.ToolParameterValidationError } =>
	AiError.isAiError(error) && error.reason._tag === "ToolParameterValidationError";

/**
 * Hoist a `$ref`-rooted JSON Schema document onto its referenced definition.
 * `Schema.toJsonSchemaDocument` emits `{ $ref: "#/$defs/<id>", $defs }` for
 * any schema annotated with an `identifier` — every result schema here is —
 * and a strict MCP client needs a `type: "object"` root on `outputSchema`,
 * so without this no tool would serve one. The definitions stay attached
 * for nested refs. (rc.116's own `registerToolkit` inlines the top-level
 * reference of the INPUT schema through an internal helper and serves the
 * output document verbatim; this is the public-API equivalent for both.)
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

/**
 * The served input schema: MCP requires an object root, so a top-level `$ref`
 * is inlined, and a strict tool is emitted with `onExcessProperty: "error"`
 * so the client sees `additionalProperties: false`. Mirrors rc.116's
 * `toolInputJsonSchema` through public API (`Schema.toJsonSchemaDocument` +
 * {@link hoistRootRef} in place of the internal `resolveTopLevelReference`).
 */
const toolInputJsonSchema = (schema: Schema.Constraint, strict: boolean): Record<string, unknown> => {
	const document = Schema.toJsonSchemaDocument(schema, { onExcessProperty: strict ? "error" : "ignore" });
	const withDefs =
		Object.keys(document.definitions).length === 0
			? document.schema
			: { ...document.schema, $defs: document.definitions };
	return hoistRootRef(withDefs as Record<string, unknown>);
};

/** MCP models `structuredContent` as a JSON object, so a `null` or array encoded result is omitted. */
const toStructuredContent = (value: unknown): Schema.JsonObject | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Schema.JsonObject) : undefined;

/**
 * Register a toolkit with the running `McpServer`, rendering each success as
 * the tool's markdown transcript in `content[0].text` and the encoded result
 * in `structuredContent`. A port of rc.116's `McpServer.registerToolkit`
 * that differs in the success branch and the `outputSchema` gate only (see
 * the module remarks).
 *
 * @remarks
 * `Effect.context<never>()` captures the registration-time services (the
 * handlers' declared dependencies, discharged by the runtime layer) so each
 * call runs against them; the per-request services (`McpRequestContext`,
 * the legacy `McpServerClient`, the HTTP request, the request log level) are
 * omitted from that capture because the framework provides them per call.
 *
 * @internal exported for the in-process suite, which registers fixture
 * toolkits (a strict tool, for one) through the same path the served
 * toolkit takes.
 */
export const registerSilkToolkit = <Tools extends Record<string, Tool.Any>>(
	toolkit: Toolkit.Toolkit<Tools>,
): Effect.Effect<
	void,
	never,
	McpServer.McpServer | Tool.HandlersFor<Tools> | Exclude<Tool.HandlerServices<Tools>, McpSchema.McpRequestContext>
> =>
	Effect.gen(function* () {
		const registry = yield* McpServer.McpServer;
		const built = yield* (
			toolkit as unknown as Effect.Effect<
				Toolkit.WithHandler<Tools>,
				never,
				Exclude<Tool.HandlersFor<Tools>, McpSchema.McpRequestContext>
			>
		).pipe(
			Effect.updateContext(
				(context: Context.Context<Exclude<Tool.HandlersFor<Tools>, McpSchema.McpRequestContext>>) => {
					// Toolkit handlers also retain the context in which their layer was built.
					const services = new Map(context.mapUnsafe);
					for (const tool of Object.values(toolkit.tools)) {
						const handler = services.get(tool.id) as Tool.Handler<string> | undefined;
						if (handler !== undefined) {
							services.set(tool.id, { ...handler, context: omitRequestServices(handler.context) });
						}
					}
					return Context.makeUnsafe(services);
				},
			),
		);
		const services = omitRequestServices(yield* Effect.context<never>());
		const reportCause = (cause: Cause.Cause<unknown>) => Effect.provideContext(ErrorReporter.report(cause), services);
		// Interruption propagates; anything else is logged, reported and scrubbed.
		const internalToolError = (cause: Cause.Cause<unknown>) => {
			const failure = Cause.findFail(cause);
			return Result.isFailure(failure) && !Cause.hasDies(cause)
				? Effect.failCause(failure.failure)
				: Effect.logError(cause).pipe(
						Effect.andThen(reportCause(cause)),
						Effect.as(toolErrorResult(INTERNAL_TOOL_ERROR_MESSAGE)),
					);
		};
		const registrations: Array<Parameters<typeof registry.addTool>[0]> = [];
		for (const tool of Object.values(built.tools) as ReadonlyArray<Tool.Any>) {
			const strict = Tool.getStrictMode(tool) === true;
			const rawJsonSchema = Tool.isDynamic(tool) ? tool.jsonSchema : undefined;
			if (strict && rawJsonSchema !== undefined) {
				return yield* Effect.die(
					`McpServer cannot strictly validate the raw JSON Schema for tool '${tool.name}'; use an Effect Schema instead`,
				);
			}
			const decodeOptions: SchemaAST.ParseOptions | undefined = strict ? { onExcessProperty: "error" } : undefined;
			const annotations = tool.annotations;
			const renderMarkdown = Context.getOrUndefined(annotations, SilkMarkdown);
			const toolMeta = Context.getOrUndefined(annotations, Tool.Meta);
			const isDeclaredFailure = Schema.is(tool.failureSchema);
			const encodeFailure = Schema.encodeUnknownEffect(tool.failureSchema) as (
				error: unknown,
			) => Effect.Effect<unknown, Schema.SchemaError, Tool.HandlerServices<Tools[keyof Tools]>>;
			const declaredFailureResult = (error: unknown) =>
				error instanceof Error
					? Effect.succeed(toolErrorResult(error.message))
					: Effect.map(
							encodeFailure(error),
							(encoded) => new McpSchema.CallToolResult({ isError: true, content: toolResultContent(encoded) }),
						);
			const handleCause = (cause: Cause.Cause<unknown>) => {
				const failure = Cause.findFail(cause);
				if (Result.isSuccess(failure)) {
					const error = failure.success.error;
					const origin = Context.get(Cause.reasonAnnotations(failure.success), Toolkit.FailureOrigin);
					if (origin === "parameters" && isParameterValidationError(error)) {
						return Effect.fail(new McpSchema.InvalidParams({ message: error.reason.message }));
					}
					if (origin === "handler" && isDeclaredFailure(error)) {
						// Deviation (iv): rc.116 stopped logging declared failures; this
						// server keeps the pre-rc.116 every-failing-call log line so the stderr
						// routing proof (gotcha 4, the e2e lifecycle suite) stays observable.
						return Effect.logError(cause).pipe(
							Effect.andThen(Effect.catchCause(declaredFailureResult(error), internalToolError)),
						);
					}
				}
				return internalToolError(cause);
			};
			const outputJsonSchema = hoistRootRef(
				Tool.getJsonSchemaFromSchema(tool.successSchema) as Record<string, unknown>,
			);
			const outputSchema =
				outputJsonSchema.type === "object"
					? yield* Schema.decodeUnknownEffect(McpSchema.ToolOutputJson)(outputJsonSchema).pipe(Effect.orDie)
					: undefined;
			const inputSchema = yield* Schema.decodeUnknownEffect(McpSchema.ToolJson)(
				rawJsonSchema ?? toolInputJsonSchema(tool.parametersSchema, strict),
			).pipe(Effect.orDie);
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
			registrations.push({
				tool: mcpTool,
				annotations,
				handle: (payload: unknown) =>
					built.handle(tool.name as keyof Tools, (payload ?? {}) as never, undefined, decodeOptions).pipe(
						Stream.unwrap,
						Stream.runLast,
						Effect.flatMap(Effect.fromOption),
						Effect.flatMap((result) =>
							// Declared failures return their encoded payload; anything else is classified by origin.
							result.isFailure && result.failureOrigin !== "handler"
								? Effect.failCause(
										Cause.annotate(
											Cause.fail(result.result),
											Context.make(Toolkit.FailureOrigin, result.failureOrigin ?? "result"),
										),
									)
								: Effect.succeed(
										new McpSchema.CallToolResult({
											isError: result.isFailure,
											structuredContent: result.isFailure ? undefined : toStructuredContent(result.encodedResult),
											content:
												result.isFailure || renderMarkdown === undefined
													? toolResultContent(result.encodedResult)
													: [{ type: "text", text: renderMarkdown(result.result) }],
										}),
									),
						),
						Effect.catchCause(handleCause),
						Effect.provideContext(services as Context.Context<Tool.HandlerServices<Tools[keyof Tools]>>),
					),
			});
		}
		for (const registration of registrations) {
			yield* registry.addTool(registration);
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
 * `protocols` lists the stateless `2026-07-28` adapter first, then the two
 * newest stateful ones — see gotcha 2 in the module remarks.
 * `Cause.IllegalArgumentError` in `layerStdio`'s error channel is `orDie`d:
 * `protocols` is a static literal with exactly one stateless member, so a
 * failure there is an implementer-time defect, not a runtime condition.
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
				description: "Structured Silk Suite workspace tools: workspace, turbo, biome, changesets and vendored repos.",
				instructions: SERVER_INSTRUCTIONS,
				protocols: [McpProtocol.v2026_07_28, McpProtocol.v2025_11_25, McpProtocol.v2025_06_18],
			}),
		),
		Layer.orDie,
	);

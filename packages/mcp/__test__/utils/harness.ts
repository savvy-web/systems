/**
 * An in-process JSON-RPC-over-stdio harness for `ServerLayer(cwd)`: the real
 * server layer over the real `NodeServices.layer`, with `Stdio` swapped for
 * `Stdio.layerTest` so a test drives stdin and reads stdout/stderr through
 * queues — no child process. Ported from Effect's own `McpStdioHarness`
 * (`.repos/effect/packages/effect/test/unstable/ai/McpServer/TestUtils/McpStdioHarness.ts`).
 */

import { NodeServices } from "@effect/platform-node";
import type { Scope } from "effect";
import { Deferred, Effect, Layer, Queue, Sink, Stdio, Stream } from "effect";

import { ServerLayer } from "../../src/server.js";

export interface JsonRpcMessage {
	readonly jsonrpc: "2.0";
	readonly id?: string | number | null | undefined;
	readonly method?: string | undefined;
	readonly params?: unknown;
	readonly result?: unknown;
	readonly error?: unknown;
}

export interface ServedTool {
	readonly name: string;
	readonly title?: string;
	readonly description?: string;
	readonly inputSchema: Record<string, unknown>;
	readonly outputSchema?: Record<string, unknown>;
	readonly annotations?: Record<string, unknown>;
}

export interface CallToolResult {
	readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
	readonly structuredContent?: unknown;
	readonly isError?: boolean;
}

export interface SilkMcpHarness {
	readonly initialize: Effect.Effect<JsonRpcMessage>;
	readonly sendRequest: (method: string, params?: unknown) => Effect.Effect<JsonRpcMessage>;
	readonly sendNotification: (method: string, params?: unknown) => Effect.Effect<void>;
	readonly listTools: Effect.Effect<ReadonlyArray<ServedTool>>;
	/** The `tools/call` result, or the whole JSON-RPC error response when the call was rejected at the protocol level. */
	readonly callTool: (name: string, args?: unknown) => Effect.Effect<CallToolResult | JsonRpcMessage>;
	/** Everything written to stderr so far. */
	readonly stderrSoFar: Effect.Effect<string>;
}

const isJsonRpcMessage = (value: unknown): value is JsonRpcMessage =>
	typeof value === "object" && value !== null && (value as JsonRpcMessage).jsonrpc === "2.0";

const isResponse = (message: JsonRpcMessage): message is JsonRpcMessage & { readonly id: string | number } =>
	(typeof message.id === "string" || typeof message.id === "number") && message.method === undefined;

const requestKey = (id: string | number) => `${typeof id}:${id}`;

/** Build the server for `cwd` inside the current scope and return a client over its stdio. */
export const makeHarness = (cwd: string): Effect.Effect<SilkMcpHarness, never, Scope.Scope> =>
	Effect.gen(function* () {
		const stdin = yield* Queue.unbounded<Uint8Array>();
		const stdout = yield* Queue.unbounded<string | Uint8Array>();
		const stderr = yield* Queue.unbounded<string | Uint8Array>();
		const messages = yield* Queue.unbounded<JsonRpcMessage>();
		const responseQueues = new Map<string, Queue.Queue<JsonRpcMessage>>();
		const encoder = new TextEncoder();
		const stdoutDecoder = new TextDecoder();
		const stderrDecoder = new TextDecoder();
		let stderrText = "";
		let nextRequestId = 1;

		const stdioLayer = Stdio.layerTest({
			stdin: Stream.fromQueue(stdin),
			// biome-ignore lint/suspicious/useIterableCallbackReturn: Sink.forEach's callback returns the offering Effect; this is not Array#forEach.
			stdout: () => Sink.forEach((chunk: string | Uint8Array) => Queue.offer(stdout, chunk)),
			// biome-ignore lint/suspicious/useIterableCallbackReturn: Sink.forEach's callback returns the offering Effect; this is not Array#forEach.
			stderr: () => Sink.forEach((chunk: string | Uint8Array) => Queue.offer(stderr, chunk)),
		});

		const ready = yield* Deferred.make<void>();
		yield* Effect.gen(function* () {
			yield* Layer.build(ServerLayer(cwd).pipe(Layer.provide(stdioLayer), Layer.provide(NodeServices.layer)));
			yield* Deferred.succeed(ready, undefined);
			return yield* Effect.never;
		}).pipe(Effect.scoped, Effect.forkScoped);
		yield* Deferred.await(ready);

		const routeFrame = (frame: JsonRpcMessage): Effect.Effect<void> =>
			Effect.gen(function* () {
				if (isResponse(frame)) {
					const responseQueue = responseQueues.get(requestKey(frame.id));
					if (responseQueue !== undefined) {
						yield* Queue.offer(responseQueue, frame);
						return;
					}
				}
				yield* Queue.offer(messages, frame);
			});

		yield* Effect.gen(function* () {
			let pending = "";
			while (true) {
				const chunk = yield* Queue.take(stdout);
				pending += typeof chunk === "string" ? chunk : stdoutDecoder.decode(chunk, { stream: true });
				let newline = pending.indexOf("\n");
				while (newline !== -1) {
					const line = pending.slice(0, newline);
					pending = pending.slice(newline + 1);
					if (line.length > 0) {
						const frame = JSON.parse(line) as unknown;
						if (!isJsonRpcMessage(frame)) {
							return yield* Effect.die(new Error(`stdout carried a non-JSON-RPC line: ${line}`));
						}
						yield* routeFrame(frame);
					}
					newline = pending.indexOf("\n");
				}
			}
		}).pipe(Effect.forkScoped);

		yield* Effect.gen(function* () {
			while (true) {
				const chunk = yield* Queue.take(stderr);
				stderrText += typeof chunk === "string" ? chunk : stderrDecoder.decode(chunk, { stream: true });
			}
		}).pipe(Effect.forkScoped);

		const sendRaw = (message: unknown): Effect.Effect<void> =>
			Queue.offer(stdin, encoder.encode(`${JSON.stringify(message)}\n`)).pipe(Effect.asVoid);
		const sendNotification = (method: string, params?: unknown): Effect.Effect<void> =>
			sendRaw({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
		const sendRequest = (method: string, params?: unknown): Effect.Effect<JsonRpcMessage> =>
			Effect.gen(function* () {
				const id = nextRequestId++;
				const responseQueue = yield* Queue.unbounded<JsonRpcMessage>();
				const key = requestKey(id);
				responseQueues.set(key, responseQueue);
				yield* sendRaw({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
				return yield* Queue.take(responseQueue).pipe(Effect.ensuring(Effect.sync(() => responseQueues.delete(key))));
			});

		const initialize: Effect.Effect<JsonRpcMessage> = Effect.gen(function* () {
			const response = yield* sendRequest("initialize", {
				protocolVersion: "2025-11-25",
				capabilities: {},
				clientInfo: { name: "savvy-mcp-test", version: "0.0.0" },
			});
			yield* sendNotification("notifications/initialized");
			return response;
		});

		const listTools: Effect.Effect<ReadonlyArray<ServedTool>> = sendRequest("tools/list").pipe(
			Effect.map((response) => (response.result as { readonly tools: ReadonlyArray<ServedTool> }).tools),
		);
		const callTool = (name: string, args?: unknown): Effect.Effect<CallToolResult | JsonRpcMessage> =>
			sendRequest("tools/call", { name, arguments: args ?? {} }).pipe(
				Effect.map((response) => (response.error === undefined ? (response.result as CallToolResult) : response)),
			);

		return {
			initialize,
			sendRequest,
			sendNotification,
			listTools,
			callTool,
			stderrSoFar: Effect.sync(() => stderrText),
		};
	});

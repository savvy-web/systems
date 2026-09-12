/**
 * The built bin over a real process boundary. The one assertion nothing else
 * can make: **stderr is empty** across a full handshake — the only thing that
 * catches a logger writing to stdout (gotcha 4) or a startup warning — and a
 * clean stdin close exits **0**, not 130 (gotcha 5).
 */

import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { fixtureWorkspace } from "../utils/fixture.js";
import type { McpProcess } from "./utils/mcp-process.js";
import { spawnMcp } from "./utils/mcp-process.js";

const ENV = {
	PATH: process.env.PATH ?? "",
	HOME: process.env.HOME ?? "",
	NO_COLOR: "1",
} as const;

const INITIALIZE = {
	jsonrpc: "2.0",
	id: 1,
	method: "initialize",
	params: {
		protocolVersion: "2025-11-25",
		capabilities: {},
		clientInfo: { name: "savvy-mcp-e2e", version: "0.0.0" },
	},
} as const;

interface JsonRpcLine {
	readonly jsonrpc?: unknown;
	readonly id?: unknown;
	readonly method?: unknown;
	readonly result?: unknown;
	readonly error?: unknown;
}

/**
 * Read stdout lines until one carries the requested `id`, collecting every
 * line seen on the way — the server emits `notifications/tools/list_changed`
 * after boot and its arrival interleaves with the next response.
 */
const readUntilResponse = (server: McpProcess, id: number) =>
	Effect.gen(function* () {
		const seen: Array<JsonRpcLine> = [];
		while (true) {
			const parsed = JSON.parse(yield* server.nextLine) as JsonRpcLine;
			seen.push(parsed);
			if (parsed.id === id) return { response: parsed, seen };
		}
	});

const readResponse = (server: McpProcess, id: number) =>
	Effect.map(readUntilResponse(server, id), ({ response }) => response);

/**
 * Close stdin, wait for the exit code (bounded), then read stderr AFTER the
 * collector has drained — so a line written during teardown is covered too.
 */
const shutdown = (server: McpProcess) =>
	Effect.gen(function* () {
		yield* server.closeStdin;
		const code = yield* server.exitCode.pipe(
			Effect.timeoutOrElse({ duration: "5 seconds", orElse: () => Effect.fail("did not exit" as const) }),
		);
		const stderr = yield* server.stderrFinal;
		return { code, stderr };
	});

describe("savvy-mcp server lifecycle (dist/dev bin)", () => {
	it.effect("completes the initialize handshake on stdout with EMPTY stderr and exits 0 on stdin close", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* spawnMcp(ENV, [dir]);
			yield* server.send(INITIALIZE);
			const { response, seen } = yield* readUntilResponse(server, 1);
			for (const line of seen) assert.strictEqual(line.jsonrpc, "2.0");
			const result = response.result as {
				readonly protocolVersion: string;
				readonly serverInfo: { readonly name: string; readonly version: string };
			};
			assert.strictEqual(result.serverInfo.name, "savvy-mcp");
			assert.match(result.serverInfo.version, /^\d+\.\d+\.\d+/);
			assert.strictEqual(result.protocolVersion, "2025-11-25");
			const { code, stderr } = yield* shutdown(server);
			assert.strictEqual(code, 0);
			assert.strictEqual(stderr, "");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("tools/list returns ten tools", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* spawnMcp(ENV, [dir]);
			yield* server.send(INITIALIZE);
			yield* readResponse(server, 1);
			yield* server.send({ jsonrpc: "2.0", method: "notifications/initialized" });
			yield* server.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
			const listed = (yield* readResponse(server, 2)) as {
				readonly result: { readonly tools: ReadonlyArray<{ readonly name: string }> };
			};
			assert.strictEqual(listed.result.tools.length, 10);
			const { code, stderr } = yield* shutdown(server);
			assert.strictEqual(code, 0);
			assert.strictEqual(stderr, "");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("tools/call workspace_info against a tmp fixture returns structuredContent and a markdown transcript", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* spawnMcp(ENV, [dir]);
			yield* server.send(INITIALIZE);
			yield* readResponse(server, 1);
			yield* server.send({ jsonrpc: "2.0", method: "notifications/initialized" });
			yield* server.send({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/call",
				params: { name: "workspace_info", arguments: {} },
			});
			const response = (yield* readResponse(server, 2)) as {
				readonly result: {
					readonly isError?: boolean;
					readonly content: ReadonlyArray<{ readonly type: string; readonly text: string }>;
					readonly structuredContent: { readonly root: string; readonly workspaceCount: number };
				};
			};
			assert.notOk(response.result.isError);
			assert.strictEqual(response.result.structuredContent.root, dir);
			assert.ok(response.result.structuredContent.workspaceCount >= 1);
			assert.ok(response.result.content[0]?.text.startsWith("# Workspace:"));
			const { code, stderr } = yield* shutdown(server);
			assert.strictEqual(code, 0);
			assert.strictEqual(stderr, "");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	// Gotcha 4's pin. The server logs every failing tools/call at error level;
	// with `Logger.LogToStderr` provided in main.ts that line lands on stderr.
	// Without it the line lands on stdout and the JSON-RPC parse below throws.
	// The response is read BEFORE stdin closes: a piped EOF interrupts an
	// in-flight call and its response is never written (gotcha 5's corollary).
	it.effect("a failing tools/call logs to stderr, never to the stdout wire, and still exits 0", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* spawnMcp(ENV, [dir]);
			yield* server.send(INITIALIZE);
			const { seen: fromInitialize } = yield* readUntilResponse(server, 1);
			yield* server.send({ jsonrpc: "2.0", method: "notifications/initialized" });
			yield* server.send({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/call",
				params: { name: "workspace_info", arguments: { cwd: "/" } },
			});
			const { response, seen: fromCall } = yield* readUntilResponse(server, 2);
			for (const line of [...fromInitialize, ...fromCall]) assert.strictEqual(line.jsonrpc, "2.0");
			const result = response.result as {
				readonly isError?: boolean;
				readonly content: ReadonlyArray<{ readonly text: string }>;
			};
			assert.strictEqual(result.isError, true);
			assert.ok(result.content[0]?.text.includes("Try workspace_info."));
			const { code, stderr } = yield* shutdown(server);
			assert.strictEqual(code, 0);
			assert.ok(stderr.includes("WorkspaceNotFound"), `stderr should carry the error log line, got: ${stderr}`);
			assert.ok(stderr.includes("ERROR"), stderr);
			assert.notOk(stderr.includes('"jsonrpc"'), stderr);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});

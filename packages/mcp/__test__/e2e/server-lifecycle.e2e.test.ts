/**
 * The built bin over a real process boundary, driven by `@effected/mcp/testing`'s
 * `McpProbe` and `McpProcess`. The one assertion nothing else can make:
 * **stderr is empty** across a full handshake — the only thing that catches a
 * logger writing to stdout or a startup warning — and a clean stdin close
 * exits **0**, not 130 (`McpStdio.teardown`).
 */

import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import type { McpProcess } from "@effected/mcp/testing";
import { McpProcess as Mcp, McpProbe } from "@effected/mcp/testing";
import { Effect } from "effect";
import { ChildProcess } from "effect/unstable/process";

import { fixtureWorkspace } from "../utils/fixture.js";

const MCP_BIN = resolve(import.meta.dirname, "..", "..", "dist", "dev", "pkg", "bin", "savvy-mcp.js");

const ENV = {
	PATH: process.env.PATH ?? "",
	HOME: process.env.HOME ?? "",
	NO_COLOR: "1",
} as const;

/** What some Claude Code launch paths pass through when they fail to substitute the variable. */
// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder is the input under test
const UNSUBSTITUTED = "${CLAUDE_PROJECT_DIR}";

const command = (args: ReadonlyArray<string>, extraEnv: Readonly<Record<string, string>> = {}) =>
	ChildProcess.make(process.execPath, [MCP_BIN, ...args], { env: { ...ENV, ...extraEnv } });

/**
 * Close stdin, wait for the exit code (bounded), then read stderr AFTER the
 * child has exited — so a line written during teardown is covered too.
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

const callTool = (server: McpProcess, id: number, name: string, args: unknown) =>
	Effect.gen(function* () {
		yield* server.send({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
		return yield* server.readUntilResponse(id);
	});

describe("savvy-mcp server lifecycle (dist/dev bin)", () => {
	it.effect("completes the initialize handshake on stdout with EMPTY stderr and exits 0 on stdin close", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const probe = yield* McpProbe.initialize(command([dir]));
			assert.isUndefined(probe.response.error);
			const result = probe.response.result as {
				readonly protocolVersion: string;
				readonly serverInfo: { readonly name: string; readonly version: string };
			};
			assert.strictEqual(result.serverInfo.name, "savvy-mcp");
			assert.match(result.serverInfo.version, /^\d+\.\d+\.\d+$/);
			assert.strictEqual(result.protocolVersion, "2025-11-25");
			assert.strictEqual(probe.stderr, "");
			assert.strictEqual(probe.exitCode, 0);
		}).pipe(Effect.scoped, Effect.timeout("30 seconds"), Effect.provide(NodeServices.layer)),
	);

	it.effect("tools/list returns ten tools", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* Mcp.spawn(command([dir]));
			yield* server.handshake();
			yield* server.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
			const { response } = yield* server.readUntilResponse(2);
			const listed = response.result as { readonly tools: ReadonlyArray<{ readonly name: string }> };
			assert.strictEqual(listed.tools.length, 10);
			const { code, stderr } = yield* shutdown(server);
			assert.strictEqual(code, 0);
			assert.strictEqual(stderr, "");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("tools/call workspace_info against a tmp fixture returns structuredContent and a markdown transcript", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* Mcp.spawn(command([dir]));
			yield* server.handshake();
			const { response } = yield* callTool(server, 2, "workspace_info", {});
			const result = response.result as {
				readonly isError?: boolean;
				readonly content: ReadonlyArray<{ readonly type: string; readonly text: string }>;
				readonly structuredContent: { readonly root: string; readonly workspaceCount: number };
			};
			assert.notOk(result.isError);
			assert.strictEqual(result.structuredContent.root, dir);
			assert.ok(result.structuredContent.workspaceCount >= 1);
			assert.ok(result.content[0]?.text.startsWith("# Workspace:"));
			const { code, stderr } = yield* shutdown(server);
			assert.strictEqual(code, 0);
			assert.strictEqual(stderr, "");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("answers a non-JSON stdin line with a -32700 parse error and keeps serving", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* Mcp.spawn(command([dir]));
			yield* server.handshake();
			yield* server.sendRaw("this is not json\n");
			const parseError = JSON.parse(yield* server.nextLine) as {
				readonly id?: unknown;
				readonly error?: { readonly code: number };
			};
			assert.strictEqual(parseError.error?.code, -32700);
			assert.strictEqual(parseError.id, null);
			yield* server.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
			const { response } = yield* server.readUntilResponse(2);
			assert.isUndefined(response.error);
			const { code } = yield* shutdown(server);
			assert.strictEqual(code, 0);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect(`skips an unsubstituted ${UNSUBSTITUTED} argument and roots in SAVVY_MCP_PROJECT_DIR`, () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* Mcp.spawn(command([UNSUBSTITUTED], { SAVVY_MCP_PROJECT_DIR: dir }));
			yield* server.handshake();
			const { response } = yield* callTool(server, 2, "workspace_info", {});
			const result = response.result as { readonly structuredContent: { readonly root: string } };
			assert.strictEqual(result.structuredContent.root, dir);
			yield* shutdown(server);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	// The server logs every failing tools/call at error level; `McpStdio`
	// routes that line to stderr. Were it on stdout, `readUntilResponse`'s
	// JSON-RPC parse would fail. The response is read BEFORE stdin closes: a
	// piped EOF interrupts an in-flight call and its response is never written.
	it.effect("a failing tools/call logs to stderr, never to the stdout wire, and still exits 0", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace("mcp-e2e-");
			const server = yield* Mcp.spawn(command([dir]));
			yield* server.handshake();
			const { response } = yield* callTool(server, 2, "workspace_info", { cwd: "/" });
			const result = response.result as {
				readonly isError?: boolean;
				readonly content: ReadonlyArray<{ readonly text: string }>;
			};
			assert.strictEqual(result.isError, true);
			assert.ok(result.content[0]?.text.includes("Try workspace_info."));
			const { code, stderr } = yield* shutdown(server);
			assert.strictEqual(code, 0);
			assert.ok(stderr.includes("WorkspaceNotFound"), `stderr should carry the error log line, got: ${stderr}`);
			assert.notOk(stderr.includes('"jsonrpc"'), stderr);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});

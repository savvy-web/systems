/**
 * Proves the carrier's two bin shims work as BUILT artifacts.
 *
 * @remarks
 * `@savvy-web/silk` owns the `savvy` and `savvy-mcp` bin entries so a consumer
 * gets both off its single direct dependency on silk. Each shim is a one-line
 * import of the front end's `./main`, so what this test really exercises is
 * that `dist/dev/pkg/bin/*.js` resolves `@savvy-web/cli/main` and
 * `@savvy-web/mcp/main` through silk's own dependency graph and that the front
 * ends behave over a real process boundary: the CLI reports its version and
 * exits 0; the MCP server answers `initialize` on stdout, keeps stderr silent
 * and exits 0 when stdin closes.
 *
 * The packed-install half (the same bins reached via `node_modules/.bin` of a
 * scratch project outside the workspace) lives in `@e2e/silk`.
 */

import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Run } from "@effected/commands";
import { Effect, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

const binDir = resolve(import.meta.dirname, "..", "..", "dist", "dev", "pkg", "bin");

/** node -> the front end's import graph; the 5 s default is tight on CI. */
const BIN_TIMEOUT_MS = 30_000;

/**
 * `stdin` is a `ChildProcess.CommandOptions` field, not a `Run.collect` option.
 * Its type is `CommandInput`, which does not accept a string, so the request is
 * encoded to bytes and wrapped in a `Stream`; stdin closes when the stream
 * ends, which is what makes the MCP server exit.
 *
 * `env` is passed whole and `extendEnv` is never set, so `PATH` and `HOME`
 * must be listed explicitly.
 */
const runBin = (name: string, args: ReadonlyArray<string>, stdin?: string) =>
	Run.collect(
		ChildProcess.make(process.execPath, [resolve(binDir, name), ...args], {
			env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NO_COLOR: "1" },
			...(stdin === undefined ? {} : { stdin: Stream.make(new TextEncoder().encode(stdin)) }),
		}),
	);

const initializeRequest = `${JSON.stringify({
	jsonrpc: "2.0",
	id: 1,
	method: "initialize",
	params: {
		protocolVersion: "2025-06-18",
		capabilities: {},
		clientInfo: { name: "silk-bins-e2e", version: "0.0.0" },
	},
})}\n`;

describe("@savvy-web/silk carrier bins (dist/dev)", () => {
	it.effect(
		"savvy.js runs and reports a version",
		() =>
			Effect.gen(function* () {
				const result = yield* runBin("savvy.js", ["--version"]);
				assert.match(result.stdout.trim(), /^savvy v\d+\.\d+\.\d+/);
				assert.strictEqual(result.exitCode, 0);
			}).pipe(Effect.provide(NodeServices.layer)),
		BIN_TIMEOUT_MS,
	);

	it.effect(
		"savvy-mcp.js completes an initialize handshake on stdout, silent on stderr, exit 0",
		() =>
			Effect.gen(function* () {
				const result = yield* runBin("savvy-mcp.js", [], initializeRequest);
				// The server answers on stdout and must keep logs off that wire.
				assert.include(result.stdout, '"jsonrpc":"2.0"');
				assert.include(result.stdout, '"serverInfo"');
				// Nothing at all may reach stderr — a client treats it as noise or a fault.
				assert.strictEqual(result.stderr, "");
				// A clean stdin close is exit 0, not 130.
				assert.strictEqual(result.exitCode, 0);
			}).pipe(Effect.provide(NodeServices.layer)),
		BIN_TIMEOUT_MS,
	);
});

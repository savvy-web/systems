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
import { McpProbe } from "@effected/mcp/testing";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";

const binDir = resolve(import.meta.dirname, "..", "..", "dist", "dev", "pkg", "bin");

/** node -> the front end's import graph; the 5 s default is tight on CI. */
const BIN_TIMEOUT_MS = 30_000;

/**
 * An explicit environment, not `process.env`: `env` is passed whole and
 * `extendEnv` is never set, so `PATH` and `HOME` are listed. This is the
 * kit's own guidance for a bin run straight out of `dist` (see `McpProcess`
 * in `@effected/mcp/testing`); `PackedInstall`'s `consumer.command` builds it
 * only for a packed-install consumer, which `@e2e/silk` covers.
 */
const ENV = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NO_COLOR: "1" } as const;

const command = (name: string, args: ReadonlyArray<string> = []) =>
	ChildProcess.make(process.execPath, [resolve(binDir, name), ...args], { env: ENV });

describe("@savvy-web/silk carrier bins (dist/dev)", () => {
	it.effect(
		"savvy.js runs and reports a version",
		() =>
			Effect.gen(function* () {
				const result = yield* Run.collect(command("savvy.js", ["--version"]));
				assert.match(result.stdout.trim(), /^savvy v\d+\.\d+\.\d+ via @savvy-web\/silk \d+\.\d+\.\d+$/);
				assert.strictEqual(result.exitCode, 0);
			}).pipe(Effect.provide(NodeServices.layer)),
		BIN_TIMEOUT_MS,
	);

	it.effect(
		"savvy-mcp.js completes an initialize handshake on stdout, silent on stderr, exit 0",
		() =>
			Effect.gen(function* () {
				// McpProbe keeps stdin open until the id-1 response arrives, then closes
				// it: closing right after the write would let a slow boot drop the
				// response and still exit 0.
				const probe = yield* McpProbe.initialize(command("savvy-mcp.js")).pipe(Effect.timeout("30 seconds"));
				assert.isUndefined(probe.response.error);
				const result = probe.response.result as { readonly serverInfo: { readonly version: string } };
				// Launched through the carrier, the server names it as its distribution.
				assert.match(result.serverInfo.version, /^\d+\.\d+\.\d+ via @savvy-web\/silk \d+\.\d+\.\d+$/);
				// Nothing at all may reach stderr — a client treats it as noise or a fault.
				assert.strictEqual(probe.stderr, "");
				// A clean stdin close is exit 0, not 130.
				assert.strictEqual(probe.exitCode, 0);
			}).pipe(Effect.provide(NodeServices.layer)),
		BIN_TIMEOUT_MS,
	);
});

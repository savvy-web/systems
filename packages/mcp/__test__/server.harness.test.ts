/**
 * The real `ServerLayer` under `@effected/mcp/testing`'s `McpHarness`: an
 * in-process client over queue-backed stdio. Covers what the kit's
 * `McpStdio.layer` promises on the wire (a non-JSON line is answered, not
 * fatal; nothing reaches stdout outside JSON-RPC), the distribution suffix in
 * `serverInfo.version`, and that the tools stay lenient toward the extra
 * arguments Claude Code sends.
 */

import { describe, expect, it } from "@effect/vitest";
import type { Distribution } from "@effected/engine";
import { McpHarness } from "@effected/mcp/testing";
import { Effect, Layer } from "effect";

import { ServerLayer } from "../src/server.js";
import { fixtureWorkspace } from "./utils/fixture.js";
import { PlatformWithoutStdio } from "./utils/harness.js";

const serve = (cwd: string, distribution?: Distribution) =>
	ServerLayer(cwd, distribution === undefined ? {} : { distribution }).pipe(Layer.provide(PlatformWithoutStdio));

const serverVersion = (initialize: { readonly result?: unknown }): string =>
	(initialize.result as { readonly serverInfo: { readonly version: string } }).serverInfo.version;

describe("savvy-mcp over McpHarness", () => {
	it.live(
		"answers a non-JSON stdin line and keeps serving, with nothing but JSON-RPC on stdout",
		() =>
			Effect.gen(function* () {
				const cwd = yield* fixtureWorkspace();
				const harness = yield* McpHarness.make(serve(cwd), { strictStdout: false });
				yield* harness.initialize;
				yield* harness.sendRaw("this is not json");
				const tools = yield* harness.listTools;
				expect(tools).toHaveLength(10);
				expect(yield* harness.consoleLogSoFar).toEqual([]);
			}).pipe(Effect.scoped),
		30_000,
	);

	it.live(
		"reports the carrier distribution in serverInfo.version",
		() =>
			Effect.gen(function* () {
				const cwd = yield* fixtureWorkspace();
				const harness = yield* McpHarness.make(serve(cwd, { name: "@savvy-web/silk", version: "9.9.9" }));
				expect(serverVersion(yield* harness.initialize)).toMatch(/ via @savvy-web\/silk 9\.9\.9$/);
			}).pipe(Effect.scoped),
		30_000,
	);

	it.live(
		"reports a bare version for a direct install",
		() =>
			Effect.gen(function* () {
				const cwd = yield* fixtureWorkspace();
				const harness = yield* McpHarness.make(serve(cwd));
				expect(serverVersion(yield* harness.initialize)).not.toContain(" via ");
			}).pipe(Effect.scoped),
		30_000,
	);

	it.live(
		"stays lenient: an undeclared argument does not reject the call",
		() =>
			Effect.gen(function* () {
				const cwd = yield* fixtureWorkspace();
				const harness = yield* McpHarness.make(serve(cwd));
				yield* harness.initialize;
				const response = yield* harness.callTool("workspace_info", { unexpected_extra: true });
				expect(response.error).toBeUndefined();
				expect((response.result as { readonly isError?: boolean }).isError).not.toBe(true);
			}).pipe(Effect.scoped),
		30_000,
	);
});

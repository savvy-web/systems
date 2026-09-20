/**
 * `Tool.Strict` through the registration port: a strict tool decodes with
 * `onExcessProperty: "error"` and serves `additionalProperties: false`; a
 * non-strict sibling keeps accepting extras (Claude Code sends `_meta`-style
 * ones on some calls). Registered through the same `registerSilkToolkit` the
 * served toolkit takes, over the same `McpServer.layerStdio`, so a drift in
 * the port's strict branch fails here and nowhere else.
 */

import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { McpProtocol, McpServer, Tool, Toolkit } from "effect/unstable/ai";

import { registerSilkToolkit } from "../src/server.js";
import type { CallToolResult, JsonRpcMessage } from "./utils/harness.js";
import { makeHarness } from "./utils/harness.js";

const Echo = Schema.Struct({ ok: Schema.Boolean });
const EchoParams = Schema.Struct({ value: Schema.String });

const strictTool = Tool.make("strict_echo", {
	description: "strict",
	parameters: EchoParams,
	success: Echo,
}).annotate(Tool.Strict, true);

const lenientTool = Tool.make("lenient_echo", {
	description: "lenient",
	parameters: EchoParams,
	success: Echo,
});

const FixtureToolkit = Toolkit.make(strictTool, lenientTool);

const FixtureLayer = Layer.effectDiscard(registerSilkToolkit(FixtureToolkit)).pipe(
	Layer.provide(McpServer.McpServer.layer),
	Layer.provide(
		FixtureToolkit.toLayer({
			strict_echo: () => Effect.succeed({ ok: true }),
			lenient_echo: () => Effect.succeed({ ok: true }),
		}),
	),
	Layer.provide(
		McpServer.layerStdio({
			name: "strict-fixture",
			version: "0.0.0",
			protocols: [McpProtocol.v2026_07_28, McpProtocol.v2025_11_25],
		}),
	),
	Layer.orDie,
);

const asResult = (value: CallToolResult | JsonRpcMessage): CallToolResult => {
	assert.ok("content" in value, `expected a tools/call result, got ${JSON.stringify(value)}`);
	return value;
};

describe("Tool.Strict through registerSilkToolkit", () => {
	it.effect("serves additionalProperties: false for the strict tool only", () =>
		Effect.gen(function* () {
			const harness = yield* makeHarness(process.cwd(), FixtureLayer);
			yield* harness.initialize;
			const tools = yield* harness.listTools;
			const strict = tools.find((t) => t.name === "strict_echo");
			const lenient = tools.find((t) => t.name === "lenient_echo");
			assert.ok(strict, "strict_echo was not registered");
			assert.ok(lenient, "lenient_echo was not registered");
			assert.strictEqual(strict.inputSchema.additionalProperties, false);
			assert.notStrictEqual(lenient.inputSchema.additionalProperties, false);
		}).pipe(Effect.scoped),
	);

	it.effect("rejects an excess property on the strict tool and accepts it on the lenient one", () =>
		Effect.gen(function* () {
			const harness = yield* makeHarness(process.cwd(), FixtureLayer);
			yield* harness.initialize;
			const rejected = asResult(yield* harness.callTool("strict_echo", { value: "x", extra: 1 }));
			assert.strictEqual(rejected.isError, true);
			assert.ok((rejected.content[0]?.text ?? "").includes("extra"), rejected.content[0]?.text);
			const accepted = asResult(yield* harness.callTool("lenient_echo", { value: "x", extra: 1 }));
			assert.notOk(accepted.isError, JSON.stringify(accepted));
			assert.deepStrictEqual(accepted.structuredContent, { ok: true });
		}).pipe(Effect.scoped),
	);
});

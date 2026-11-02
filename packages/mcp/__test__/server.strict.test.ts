/**
 * `Tool.Strict` through the registration the served toolkit takes:
 * `McpToolkit.layer(..., { strict: "annotated" })`, served by core's in-memory
 * `McpTest.makeClient` over the same protocol list `McpStdio.layer` serves
 * (strict decoding lives in the registration, not the stdio transport, which
 * `server.harness.test.ts` and the e2e suite cover). A
 * tool annotated strict decodes with `onExcessProperty: "error"` and serves
 * `additionalProperties: false`; an unannotated sibling keeps accepting
 * extras (a conservative default; `_meta` travels at `params._meta`). Every savvy-mcp
 * tool is unannotated, so this pins that the served tools stay lenient and
 * that opting one in still works.
 */

import { assert, describe, it } from "@effect/vitest";
import { McpStdio, McpToolkit } from "@effected/mcp-kit";
import { Effect, Layer, Schema } from "effect";
import { McpTest, Tool, Toolkit } from "effect/ai";

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

const FixtureLayer = McpToolkit.layer(FixtureToolkit, { strict: "annotated" }).pipe(
	Layer.provide(
		FixtureToolkit.toLayer({
			strict_echo: () => Effect.succeed({ ok: true }),
			lenient_echo: () => Effect.succeed({ ok: true }),
		}),
	),
);

/** A typed client on the newest stateful revision, the one an `initialize`-sending client lands on. */
const connect = McpTest.makeClient(FixtureLayer, { protocols: McpStdio.protocols, protocolVersion: "2025-11-25" });

describe('Tool.Strict through McpToolkit (strict: "annotated")', () => {
	it.effect("serves additionalProperties: false for the annotated tool only", () =>
		Effect.gen(function* () {
			const client = yield* connect;
			const { tools } = yield* client.listTools();
			const strict = tools.find((t) => t.name === "strict_echo");
			const lenient = tools.find((t) => t.name === "lenient_echo");
			assert.ok(strict, "strict_echo was not registered");
			assert.ok(lenient, "lenient_echo was not registered");
			assert.strictEqual(strict.inputSchema.additionalProperties, false);
			assert.notStrictEqual(lenient.inputSchema.additionalProperties, false);
		}).pipe(Effect.scoped),
	);

	it.effect("rejects an excess property on the annotated tool and accepts it on the unannotated one", () =>
		Effect.gen(function* () {
			const client = yield* connect;
			const rejected = yield* client.callTool({ name: "strict_echo", arguments: { value: "x", extra: 1 } });
			assert.strictEqual(rejected.isError, true);
			const text = rejected.content[0]?.type === "text" ? rejected.content[0].text : "";
			assert.ok(text.includes("extra"), text);
			const accepted = yield* client.callTool({ name: "lenient_echo", arguments: { value: "x", extra: 1 } });
			assert.notOk(accepted.isError, JSON.stringify(accepted));
			assert.deepStrictEqual(accepted.structuredContent, { ok: true });
		}).pipe(Effect.scoped),
	);
});

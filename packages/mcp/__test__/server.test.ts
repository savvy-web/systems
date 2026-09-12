/**
 * In-process round trips through the real `ServerLayer` over `Stdio.layerTest`
 * (no child process): the initialize handshake, the served tool list, and
 * the dual channel a successful call produces — markdown in
 * `content[0].text`, the typed object in `structuredContent` — plus the two
 * failure renderings (a declared failure as `isError` text carrying its
 * remediation, and a parameter decode failure as a JSON-RPC error).
 */

import { cpSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { Lint } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { fixtureWorkspace } from "./utils/fixture.js";
import type { CallToolResult, JsonRpcMessage } from "./utils/harness.js";
import { makeHarness } from "./utils/harness.js";

const open = () =>
	Effect.gen(function* () {
		const dir = yield* fixtureWorkspace();
		const harness = yield* makeHarness(dir);
		const initialized = yield* harness.initialize;
		return { dir, harness, initialized };
	});

const FIXTURES = resolve(import.meta.dirname, "fixtures");

/**
 * The biome_check round trip runs Biome from a tmp workspace with no
 * node_modules, so it needs a binary resolvable the same way the handler
 * resolves it (`Lint.Biome.findBiome`: global first, then the package
 * manager). Skipped, with the reason in the name, when none is found so a
 * runner without a global biome does not go red.
 */
const biomeAvailable = Lint.Biome.findBiome() !== null;

const asResult = (value: CallToolResult | JsonRpcMessage): CallToolResult => {
	assert.ok("content" in value, `expected a tools/call result, got ${JSON.stringify(value)}`);
	return value;
};

describe("ServerLayer over Stdio.layerTest", () => {
	// Stderr is NOT asserted here: the in-process harness has no logger layer
	// (main.ts owns `Logger.LogToStderr`), so the default logger writes to the
	// console, not the test sink — the e2e lifecycle suite pins gotcha 4.
	it.effect("answers initialize with the newest protocol and the server identity", () =>
		Effect.gen(function* () {
			const { initialized } = yield* open();
			const result = initialized.result as {
				readonly protocolVersion: string;
				readonly serverInfo: { readonly name: string; readonly version: string };
			};
			assert.strictEqual(result.protocolVersion, "2025-11-25");
			assert.strictEqual(result.serverInfo.name, "savvy-mcp");
			assert.strictEqual(result.serverInfo.version, "0.0.0");
		}).pipe(Effect.scoped),
	);

	it.effect("negotiates DOWN to the older listed protocol when a client offers it", () =>
		Effect.gen(function* () {
			const dir = yield* fixtureWorkspace();
			const harness = yield* makeHarness(dir);
			const response = yield* harness.sendRequest("initialize", {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "savvy-mcp-test", version: "0.0.0" },
			});
			assert.strictEqual((response.result as { readonly protocolVersion: string }).protocolVersion, "2025-06-18");
		}).pipe(Effect.scoped),
	);

	it.effect("serves ten tools, each with an object-rooted input schema and its MCP annotations", () =>
		Effect.gen(function* () {
			const { harness } = yield* open();
			const tools = yield* harness.listTools;
			assert.strictEqual(tools.length, 10);
			for (const tool of tools) {
				assert.strictEqual(tool.inputSchema.type, "object", `${tool.name} inputSchema`);
				const annotations = (tool.annotations ?? {}) as Record<string, unknown>;
				assert.isBoolean(annotations.readOnlyHint, `${tool.name} readOnlyHint`);
				assert.isBoolean(annotations.idempotentHint, `${tool.name} idempotentHint`);
				assert.isBoolean(annotations.openWorldHint, `${tool.name} openWorldHint`);
				assert.isBoolean(annotations.destructiveHint, `${tool.name} destructiveHint`);
				// The framework lifts `Tool.Title` to the top-level `title` (McpServer.ts addTool).
				assert.ok(typeof tool.title === "string" && tool.title.length > 0, `${tool.name} title`);
			}
			const readOnly = tools.filter((tool) => tool.annotations?.readOnlyHint === true).map((tool) => tool.name);
			assert.strictEqual(readOnly.length, 7);
		}).pipe(Effect.scoped),
	);

	it.effect("serves an outputSchema for every struct-rooted result and none for the union-rooted four", () =>
		Effect.gen(function* () {
			const { harness } = yield* open();
			const tools = yield* harness.listTools;
			const withOutput = tools.filter((tool) => tool.outputSchema !== undefined).map((tool) => tool.name);
			assert.deepStrictEqual(withOutput.toSorted(), [
				"biome_check",
				"changeset_deps_detect",
				"changeset_deps_regen",
				"changeset_preview",
				"changeset_validate",
				"workspace_info",
			]);
			for (const name of withOutput) {
				const tool = tools.find((candidate) => candidate.name === name);
				assert.strictEqual(tool?.outputSchema?.type, "object", `${name} outputSchema`);
			}
		}).pipe(Effect.scoped),
	);

	it.effect("workspace_info returns markdown in content[0].text AND the typed object in structuredContent", () =>
		Effect.gen(function* () {
			const { dir, harness } = yield* open();
			const result = asResult(yield* harness.callTool("workspace_info", {}));
			assert.notOk(result.isError);
			assert.strictEqual(result.content.length, 1);
			assert.strictEqual(result.content[0]?.type, "text");
			const text = result.content[0]?.text ?? "";
			assert.ok(text.startsWith(`# Workspace: ${dir}`), `markdown transcript, got: ${text.slice(0, 80)}`);
			assert.ok(text.includes("| @scope/foo |"));
			// The text channel is the markdown projection, NOT the JSON the framework would render.
			assert.notOk(text.startsWith("{"));
			const structured = result.structuredContent as {
				readonly root: string;
				readonly workspaces: ReadonlyArray<unknown>;
			};
			assert.strictEqual(structured.root, dir);
			assert.ok(structured.workspaces.length >= 1);
			assert.notOk("markdown" in (structured as object));
		}).pipe(Effect.scoped),
	);

	it.effect(
		"a declared typed failure reaches the wire as isError text carrying the remediation, no structuredContent",
		() =>
			Effect.gen(function* () {
				const { harness } = yield* open();
				// The tmpdir root itself has no workspace manifest, so the kit's root
				// walk fails with WorkspaceRootNotFoundError -> WorkspaceNotFound.
				const result = asResult(yield* harness.callTool("workspace_info", { cwd: "/" }));
				assert.strictEqual(result.isError, true);
				assert.strictEqual(result.structuredContent, undefined);
				const text = result.content[0]?.text ?? "";
				assert.ok(text.includes('No workspace root was found walking up from "/"'), text);
				assert.ok(text.includes("Try workspace_info."), text);
				// The failing call is logged — and with LogToStderr the log line must
				// not have reached the wire. The in-process harness has no LogToStderr
				// provision (main.ts owns it), so only stdout's integrity is asserted
				// here: every stdout line parsed as JSON-RPC or the harness would have died.
			}).pipe(Effect.scoped),
	);

	it.effect("a parameter decode failure is rendered as an isError result naming the bad field", () =>
		Effect.gen(function* () {
			// rc.115 maps the toolkit's ToolParameterValidationError to an
			// `isError` tool result (McpServer.ts:369-381 InvalidToolInput), not a
			// JSON-RPC error, so the model can see it and self-correct.
			const { harness } = yield* open();
			const result = asResult(yield* harness.callTool("turbo_inspect", { mode: "bogus" }));
			assert.strictEqual(result.isError, true);
			const text = result.content[0]?.text ?? "";
			assert.ok(text.includes("Invalid parameters for tool 'turbo_inspect'"), text);
			assert.ok(text.includes('["mode"]'), text);
		}).pipe(Effect.scoped),
	);

	it.effect("changeset_validate on a missing dir renders InvalidArgument with the echoed directory", () =>
		Effect.gen(function* () {
			const { harness } = yield* open();
			const result = asResult(yield* harness.callTool("changeset_validate", { dir: "does-not-exist" }));
			assert.strictEqual(result.isError, true);
			const text = result.content[0]?.text ?? "";
			assert.ok(text.includes("does-not-exist"), text);
			assert.ok(text.includes("Pass dir as a path"), text);
		}).pipe(Effect.scoped),
	);
});

// F5: one round trip per struct-rooted tool that serves an outputSchema and
// can run against the tmp fixture without git or a changesets config, so the
// hoisted schema and the encoded result are proven to agree under the
// framework's structuredContent validation (a mismatch is a
// ToolResultProjectionError, i.e. an isError result). workspace_info is
// covered above; changeset_deps_detect / changeset_deps_regen need a git
// merge-base and changeset_preview a changesets config, so they are exercised
// by their handler suites instead.
describe("ServerLayer struct-rooted results round-trip under structuredContent validation", () => {
	it.effect("changeset_validate: clean fixture -> ok=true with the served shape", () =>
		Effect.gen(function* () {
			const { dir, harness } = yield* open();
			cpSync(join(FIXTURES, "changeset-valid"), join(dir, ".changeset"), { recursive: true });
			const result = asResult(yield* harness.callTool("changeset_validate", {}));
			assert.notOk(result.isError, JSON.stringify(result));
			const structured = result.structuredContent as {
				readonly dir: string;
				readonly ok: boolean;
				readonly errorCount: number;
				readonly messages: ReadonlyArray<unknown>;
			};
			assert.strictEqual(structured.dir, join(dir, ".changeset"));
			assert.strictEqual(structured.ok, true);
			assert.strictEqual(structured.errorCount, 0);
			assert.deepStrictEqual(structured.messages, []);
			assert.ok((result.content[0]?.text ?? "").includes("No changeset issues found"));
		}).pipe(Effect.scoped),
	);

	it.effect("changeset_validate: invalid fixture -> typed diagnostics in structuredContent", () =>
		Effect.gen(function* () {
			const { dir, harness } = yield* open();
			cpSync(join(FIXTURES, "changeset-invalid"), join(dir, ".changeset"), { recursive: true });
			const result = asResult(yield* harness.callTool("changeset_validate", {}));
			assert.notOk(result.isError, JSON.stringify(result));
			const structured = result.structuredContent as {
				readonly ok: boolean;
				readonly errorCount: number;
				readonly messages: ReadonlyArray<{ readonly rule: string; readonly file: string }>;
			};
			assert.strictEqual(structured.ok, false);
			assert.ok(structured.errorCount > 0);
			assert.ok(typeof structured.messages[0]?.rule === "string");
			assert.ok((result.content[0]?.text ?? "").includes("issue(s)"));
		}).pipe(Effect.scoped),
	);

	it.effect.skipIf(!biomeAvailable)(
		"biome_check: a clean file -> zero diagnostics with the served shape (skipped when no Biome binary is resolvable)",
		() =>
			Effect.gen(function* () {
				const { dir, harness } = yield* open();
				writeFileSync(join(dir, "clean.ts"), "export const clean = 1;\n");
				const result = asResult(yield* harness.callTool("biome_check", { paths: ["clean.ts"] }));
				assert.notOk(result.isError, JSON.stringify(result));
				const structured = result.structuredContent as {
					readonly summary: { readonly errors: number; readonly warnings: number };
					readonly diagnostics: ReadonlyArray<unknown>;
					readonly wrote: boolean;
					readonly guidance: string;
				};
				assert.strictEqual(structured.summary.errors, 0);
				assert.deepStrictEqual(structured.diagnostics, []);
				assert.strictEqual(structured.wrote, false);
				assert.ok(structured.guidance.length > 0);
				assert.ok((result.content[0]?.text ?? "").startsWith("# biome — clean"));
			}).pipe(Effect.scoped),
	);
});

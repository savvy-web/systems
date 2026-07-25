import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, beforeAll, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import type { McpServices } from "../src/context.js";
import { makeSilkRuntimeLayer } from "../src/runtime.js";
import { workspaceInfo } from "../src/tools/workspace-info.js";

function setupFixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "mcp-server-"));
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "root", version: "1.0.0", private: true, workspaces: ["packages/foo"] }),
	);
	writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/foo"\n');
	writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	mkdirSync(join(dir, "packages/foo"), { recursive: true });
	writeFileSync(join(dir, "packages/foo/package.json"), JSON.stringify({ name: "@scope/foo", version: "1.0.0" }));
	return dir;
}

// The runtime is root-bound at layer build (single-root semantics), so the
// layer is built with ONE fixture root and shared by the suite. The annotation
// preserves the assertion the old `McpContext["runtime"]`-typed binding
// carried: the composed layer supplies exactly `McpServices`, error-free.
//
// ISOLATION: both tests here share this one fixture root. That is safe ONLY
// because both are read-only against it. Do NOT add a test that mutates the
// fixture without giving it its own root.
//
// The fixture is built in `beforeAll` rather than at module scope so a setup
// failure is attributed to named tests instead of silently dropping them from
// the run total. `Layer.suspend` defers `makeSilkRuntimeLayer(dir)` to layer
// BUILD time, which `layer(...)` performs in its own nested `beforeAll` — i.e.
// after this one.
let dir: string;

beforeAll(() => {
	dir = setupFixture();
});

const appLayer: Layer.Layer<McpServices> = Layer.suspend(() =>
	makeSilkRuntimeLayer(dir).pipe(Layer.provide(NodeServices.layer)),
);

afterAll(() => {
	// Guarded: if `beforeAll` failed, `dir` is undefined and an unguarded
	// `rmSync` would bury the real setup error under a TypeError.
	if (dir) {
		rmSync(dir, { recursive: true, force: true });
	}
});

layer(appLayer)("server spine – workspace_info over the real runtime", (it) => {
	it.effect("produces a structured workspace result through the runtime", () =>
		Effect.gen(function* () {
			const data = yield* workspaceInfo(dir);
			expect(data.root).toBe(dir);
			expect(data.runtime).toBe("node");
			expect(data.workspaceCount).toBeGreaterThanOrEqual(1);
			expect(data.workspaces.some((w) => w.name === "@scope/foo")).toBe(true);
		}),
	);

	it.effect("resolves the workspace root when given a subdirectory", () =>
		Effect.gen(function* () {
			const sub = join(dir, "packages/foo");
			const data = yield* workspaceInfo(sub);
			expect(data.root).toBe(dir);
			expect(data.workspaces.some((w) => w.name === "@scope/foo")).toBe(true);
		}),
	);
});

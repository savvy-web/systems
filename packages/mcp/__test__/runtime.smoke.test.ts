import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, beforeAll, expect, layer } from "@effect/vitest";
import { Changesets, SilkWorkspaceAnalyzer, Turbo } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";

import type { McpServices } from "../src/context.js";
import { makeSilkRuntimeLayer } from "../src/runtime.js";

function setupFixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "mcp-runtime-"));
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

// The runtime is root-bound at layer build (single-root semantics), so the app
// layer is built for ONE fixture root and shared by the whole suite via
// `layer(...)`. The annotation is the assertion the old `ManagedRuntime`-typed
// binding carried: the composed layer supplies exactly `McpServices` with no
// error channel.
//
// ISOLATION: every test here shares this one fixture root. That is safe ONLY
// because all of them are read-only against it. Do NOT add a test that mutates
// the fixture without giving it its own root.
//
// The fixture is built in `beforeAll` rather than at module scope so that a
// setup failure is reported as a named hook failure instead of a load-time
// throw (a load-time throw zeroes the WHOLE package: `0/0 passed`, exit 0).
// `Layer.suspend` defers `makeSilkRuntimeLayer(dir)` to layer BUILD time, which
// `layer(...)` performs in its own nested `beforeAll` — i.e. after this one.
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

layer(appLayer)("SilkRuntimeLive – layer completeness", (it) => {
	it.effect("provides SilkWorkspaceAnalyzer end-to-end against a fixture workspace", () =>
		Effect.gen(function* () {
			const analyzer = yield* SilkWorkspaceAnalyzer;
			const analysis = yield* analyzer.analyze(dir);
			expect(analysis._tag).toBe("WorkspaceAnalysis");
			expect(analysis.root).toBe(dir);
			expect(analysis.workspaces.length).toBeGreaterThanOrEqual(1);
		}),
	);

	it.effect("resolves Turbo.TurboInspector from the runtime layer", () =>
		Effect.gen(function* () {
			const inspector = yield* Turbo.TurboInspector;
			expect(typeof inspector.diagnoseCache).toBe("function");
		}),
	);

	it.effect("resolves Changesets.DepsRegen from the runtime layer", () =>
		Effect.gen(function* () {
			const svc = yield* Changesets.DepsRegen;
			expect(typeof svc.plan === "function" && typeof svc.execute === "function").toBe(true);
		}),
	);
});

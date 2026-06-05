import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { SilkWorkspaceAnalyzer, Turbo } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SilkRuntimeLive } from "../src/runtime.js";

const AppLayer = SilkRuntimeLive.pipe(Layer.provide(NodeContext.layer));

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

describe("SilkRuntimeLive – layer completeness", () => {
	let dir: string;
	beforeEach(() => {
		dir = setupFixture();
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("provides SilkWorkspaceAnalyzer end-to-end against a fixture workspace", async () => {
		const analysis = await Effect.runPromise(
			Effect.gen(function* () {
				const analyzer = yield* SilkWorkspaceAnalyzer;
				return yield* analyzer.analyze(dir);
			}).pipe(Effect.provide(AppLayer)),
		);
		expect(analysis._tag).toBe("WorkspaceAnalysis");
		expect(analysis.root).toBe(dir);
		expect(analysis.workspaces.length).toBeGreaterThanOrEqual(1);
	});

	it("resolves Turbo.TurboInspector from the runtime layer", async () => {
		const resolved = await Effect.runPromise(
			Effect.gen(function* () {
				const inspector = yield* Turbo.TurboInspector;
				return typeof inspector.diagnoseCache;
			}).pipe(Effect.provide(AppLayer)),
		);
		expect(resolved).toBe("function");
	});
});

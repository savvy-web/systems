import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { McpContext } from "../src/context.js";
import { SilkRuntimeLive } from "../src/runtime.js";
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

describe("server spine – workspace_info over the real runtime", () => {
	let dir: string;
	let runtime: McpContext["runtime"];

	beforeEach(() => {
		dir = setupFixture();
		runtime = ManagedRuntime.make(SilkRuntimeLive.pipe(Layer.provide(NodeContext.layer)));
	});
	afterEach(async () => {
		await runtime.dispose();
		rmSync(dir, { recursive: true, force: true });
	});

	it("produces a structured workspace result through the runtime", async () => {
		const data = await runtime.runPromise(workspaceInfo(dir));
		expect(data.root).toBe(dir);
		expect(data.runtime).toBe("node");
		expect(data.workspaceCount).toBeGreaterThanOrEqual(1);
		expect(data.workspaces.some((w) => w.name === "@scope/foo")).toBe(true);
	});

	it("resolves the workspace root when given a subdirectory", async () => {
		const sub = join(dir, "packages/foo");
		const data = await runtime.runPromise(workspaceInfo(sub));
		expect(data.root).toBe(dir);
		expect(data.workspaces.some((w) => w.name === "@scope/foo")).toBe(true);
	});
});

// packages/tsdown-plugins/__test__/build/build-target-groups.test.ts
import { describe, expect, it, vi } from "vitest";
import { buildTargetGroups } from "../../src/build/build-target-groups.js";

describe("buildTargetGroups", () => {
	it("calls the builder once per group with the derived outDir + emitManifest plugin", async () => {
		const calls: Array<{ outDir: string; plugins: number }> = [];
		const fakeBuild = vi.fn(async (cfg: { outDir: string; plugins: unknown[] }) => {
			calls.push({ outDir: cfg.outDir, plugins: cfg.plugins.length });
			return [];
		});
		await buildTargetGroups({
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "./src/index.ts" },
			tsconfigPath: "/tmp/t.json",
			groups: ["dev", "npm"],
			devManifest: "preserve",
			build: fakeBuild as never,
		});
		expect(fakeBuild).toHaveBeenCalledTimes(2);
		expect(calls[0].outDir).toBe("/abs/pkg/dist/dev/pkg");
		expect(calls[1].outDir).toBe("/abs/pkg/dist/prod/npm/pkg");
		expect(calls[0].plugins).toBeGreaterThanOrEqual(1); // emitManifest present
	});
});

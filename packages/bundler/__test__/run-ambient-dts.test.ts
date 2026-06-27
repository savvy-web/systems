// packages/bundler/__test__/run-ambient-dts.test.ts
import { describe, expect, it, vi } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

// Minimal IO-injected runBuild harness: a no-op build, fake meta, and captured copyAmbientDts calls.
function harness(overrides: Partial<Parameters<typeof runBuild>[1]> = {}) {
	const copies: Array<{ outDir: string; outNames: string[] }> = [];
	const base = {
		cwd: "/fake/pkg",
		argv: ["--target", "prod"],
		buildTargetGroups: vi.fn(async () => {}),
		generateMeta: vi.fn(async () => ({ apiModelPaths: [] }) as never),
		writeOutput: vi.fn(),
		writeIssues: vi.fn(() => undefined),
		writeTargetsBinding: vi.fn(() => "/fake/pkg/dist/prod/targets.json"),
		writeTsconfig: vi.fn(() => "/fake/tsconfig.json"),
		readVersion: () => "1.0.0",
		readPackageName: () => "fixture",
		readTsconfigJsx: () => ({}) as never,
		readOsCpu: () => ({ os: [], cpu: [] }),
		copyAmbientDts: (o: { ambient: Array<{ outName: string }>; outDir: string }) =>
			copies.push({ outDir: o.outDir, outNames: o.ambient.map((a) => a.outName) }),
	};
	return { copies, options: { ...base, ...overrides } };
}

describe("runBuild ambient .d.ts wiring", () => {
	it("copies ambient exports into each prod group's pkg dir", async () => {
		const { copies, options } = harness({
			readExports: () => ({ ".": "./src/index.ts", "./virtual": { types: "./src/virtual.d.ts" } }) as never,
			// Two distinct groups: npm (true-preset) + jsr (custom registry, distinct group id).
			readPublishTargets: () => ({ npm: true, jsr: { registry: "https://npm.jsr.io" } }) as never,
		});
		await runBuild(defineBuild({}), options as never);
		// one copy per resolved prod group, each into ITS OWN group dir
		expect(copies.length).toBe(2);
		const byDir = new Map(copies.map((c) => [c.outDir, c.outNames]));
		expect(byDir.size).toBe(2); // two distinct group dirs, not the same dir twice
		expect([...byDir.keys()].sort()).toEqual(["/fake/pkg/dist/prod/jsr/pkg", "/fake/pkg/dist/prod/npm/pkg"]);
		for (const outNames of byDir.values()) expect(outNames).toEqual(["virtual.d.ts"]);
	});

	it("copies ambient exports into dist/dev/pkg on a dev build", async () => {
		const { copies, options } = harness({
			argv: ["--target", "dev"],
			readExports: () => ({ ".": "./src/index.ts", "./virtual": { types: "./src/virtual.d.ts" } }) as never,
		});
		await runBuild(defineBuild({}), options as never);
		expect(copies).toEqual([{ outDir: "/fake/pkg/dist/dev/pkg", outNames: ["virtual.d.ts"] }]);
	});

	it("throws when an ambient output collides with a JS entry name", async () => {
		const { options } = harness({
			argv: ["--target", "dev"],
			readExports: () => ({ "./a/b": "./src/a/b.ts", "./a-b": "./src/a-b.d.ts" }) as never,
		});
		await expect(runBuild(defineBuild({}), options as never)).rejects.toThrow(/collides with the JS build entry/);
	});
});

// packages/bundler/__test__/run-ambient-dts.test.ts
import { describe, expect, it, vi } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

// Minimal IO-injected runBuild harness: a no-op build + fake meta. The ambient .d.ts COPY itself now
// happens inside buildTargetGroups (see packages/tsdown-plugins/__test__/build/) — this harness stubs
// buildTargetGroups entirely, so only the early fast-fail validation runBuild still owns is testable here.
function harness(overrides: Partial<Parameters<typeof runBuild>[1]> = {}) {
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
	};
	return { options: { ...base, ...overrides } };
}

describe("runBuild ambient .d.ts wiring", () => {
	it("throws when an ambient output collides with a JS entry name", async () => {
		const { options } = harness({
			argv: ["--target", "dev"],
			readExports: () => ({ "./a/b": "./src/a/b.ts", "./a-b": "./src/a-b.d.ts" }) as never,
		});
		await expect(runBuild(defineBuild({}), options as never)).rejects.toThrow(/collides with the JS build entry/);
	});
});

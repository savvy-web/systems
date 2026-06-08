// packages/bundler/__test__/run-validate.test.ts
import { describe, expect, it, vi } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

const base = {
	readVersion: () => "1.0.0",
	readPackageName: () => "pkg",
	readExports: () => ({ ".": "./src/index.ts" }),
	writeTsconfig: (c: string) => `${c}/tsconfig.json`,
	writeOutput: () => {},
};

describe("runBuild config validation (fast-fail)", () => {
	it("fails before any build when a target has a dangling from", async () => {
		const buildTargetGroups = vi.fn(async () => {});
		await expect(
			runBuild(defineBuild({}), {
				cwd: "/abs/pkg",
				argv: ["--target", "prod"],
				buildTargetGroups,
				writeTargetsBinding: vi.fn(() => "x"),
				readPublishTargets: () => ({ a: { from: "nope", registry: "https://r" } }),
				...base,
			}),
		).rejects.toThrow(/Config validation failed/);
		expect(buildTargetGroups).not.toHaveBeenCalled();
	});

	it("fails before any build on a from+name collision", async () => {
		const buildTargetGroups = vi.fn(async () => {});
		await expect(
			runBuild(defineBuild({}), {
				cwd: "/abs/pkg",
				argv: ["--target", "prod"],
				buildTargetGroups,
				writeTargetsBinding: vi.fn(() => "x"),
				readPublishTargets: () => ({ npm: true, a: { from: "npm", name: "@s/x", registry: "https://r" } }),
				...base,
			}),
		).rejects.toThrow(/Config validation failed/);
		expect(buildTargetGroups).not.toHaveBeenCalled();
	});

	it("fails before any build on an exe with no inferable targets", async () => {
		const runExeBuild = vi.fn(async () => {});
		await expect(
			runBuild(defineBuild({ exe: { fileName: "tool" } }), {
				cwd: "/abs/pkg",
				argv: ["--target", "exe"],
				runExeBuild,
				readOsCpu: () => ({ os: [], cpu: [] }),
				...base,
			}),
		).rejects.toThrow(/Config validation failed/);
		expect(runExeBuild).not.toHaveBeenCalled();
	});

	it("fails --target dev when publishTargets has a dangling from (dev never calls resolveTargets otherwise)", async () => {
		const buildTargetGroups = vi.fn(async () => {});
		await expect(
			runBuild(defineBuild({}), {
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups,
				readPublishTargets: () => ({ a: { from: "nope", registry: "https://r" } }),
				...base,
			}),
		).rejects.toThrow(/Config validation failed/);
		expect(buildTargetGroups).not.toHaveBeenCalled();
	});

	it("passes a clean config through to the build", async () => {
		const buildTargetGroups = vi.fn(async () => {});
		await runBuild(defineBuild({}), {
			cwd: "/abs/pkg",
			argv: ["--target", "dev"],
			buildTargetGroups,
			...base,
		});
		expect(buildTargetGroups).toHaveBeenCalledTimes(1);
	});
});

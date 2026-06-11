import type { BuildTargetGroupsOptions } from "@savvy-web/tsdown-plugins";
import { describe, expect, it, vi } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

const base = {
	readVersion: () => "1.0.0",
	readPackageName: () => "base",
	readExports: () => ({ ".": "./src/index.ts" }),
	writeTsconfig: (c: string) => `${c}/tsconfig.json`,
	writeOutput: () => {},
};

describe("runBuild multi-target", () => {
	it("builds one group per resolved prod group and writes the binding for --target prod", async () => {
		const buildTargetGroups = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		const writeTargetsBinding = vi.fn(() => "/abs/pkg/dist/prod/targets.json");
		await runBuild(defineBuild({ meta: false }), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups,
			writeTargetsBinding,
			readPublishTargets: () => ({ npm: true, github: "@scope/base" }),
			...base,
		});
		const groups = buildTargetGroups.mock.calls[0]?.[0]?.groups as Array<{ id: string; name: string }>;
		expect(groups.map((g) => g.id).sort()).toEqual(["github", "npm"]);
		expect(groups.find((g) => g.id === "github")?.name).toBe("@scope/base");
		expect(writeTargetsBinding).toHaveBeenCalledTimes(1);
	});

	it("defaults to a single npm group named after the base name when no targets are declared", async () => {
		const buildTargetGroups = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		const writeTargetsBinding = vi.fn(() => "x");
		await runBuild(defineBuild({ meta: false }), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups,
			writeTargetsBinding,
			readPublishTargets: () => undefined,
			...base,
		});
		const groups = buildTargetGroups.mock.calls[0]?.[0]?.groups as Array<{ id: string; name: string }>;
		expect(groups).toEqual([{ id: "npm", name: "base" }]);
	});

	it("builds a single dev group named after the base name and writes no binding for --target dev", async () => {
		const buildTargetGroups = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		const writeTargetsBinding = vi.fn(() => "x");
		await runBuild(defineBuild({}), {
			cwd: "/abs/pkg",
			argv: ["--target", "dev"],
			buildTargetGroups,
			writeTargetsBinding,
			readPublishTargets: () => ({ npm: true, github: "@scope/base" }),
			...base,
		});
		const groups = buildTargetGroups.mock.calls[0]?.[0]?.groups as Array<{ id: string; name: string }>;
		expect(groups).toEqual([{ id: "dev", name: "base" }]);
		expect(writeTargetsBinding).not.toHaveBeenCalled();
	});
});

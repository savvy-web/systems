import { describe, expect, it, vi } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

describe("runBuild meta target", () => {
	it("runs generateMeta (not a tsdown build) for --target meta", async () => {
		const generateMeta = vi.fn<
			(o: {
				dtsDir: string;
				localPaths: ReadonlyArray<string>;
			}) => Promise<{ apiJsonPath: string; apiJsonFilename: string }>
		>(async () => ({ apiJsonPath: "/x/fixture.api.json", apiJsonFilename: "fixture.api.json" }));
		const build = vi.fn(async () => {});
		await runBuild(defineBuild({ meta: { localPaths: ["../models"] } }), {
			cwd: "/abs/pkg",
			argv: ["--target", "meta"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "/fake/tsconfig.json",
			writeOutput: () => {},
		});
		expect(build).not.toHaveBeenCalled();
		expect(generateMeta).toHaveBeenCalledTimes(1);
		const arg = generateMeta.mock.calls[0]?.[0];
		expect(arg?.dtsDir).toContain("dist/dev");
		expect(arg?.localPaths).toEqual(["../models"]);
	});

	it("throws when --target meta is requested but no meta option is configured", async () => {
		const generateMeta = vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		await expect(
			runBuild(defineBuild({}), {
				cwd: "/abs/pkg",
				argv: ["--target", "meta"],
				buildTargetGroups: build,
				generateMeta,
				readPackageName: () => "@scope/fixture",
				readVersion: () => "1.0.0",
				readExports: () => ({ ".": "./src/index.ts" }),
				writeTsconfig: () => "/fake/tsconfig.json",
				writeOutput: () => {},
			}),
		).rejects.toThrow("`savvy build --target meta` requires a `meta` option");
		expect(generateMeta).not.toHaveBeenCalled();
		expect(build).not.toHaveBeenCalled();
	});

	it("falls back to the first group's dir for meta when no group is named after the package", async () => {
		const generateMeta = vi.fn<
			(o: { dtsDir: string; outMetaDir: string }) => Promise<{ apiJsonPath: string; apiJsonFilename: string }>
		>(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		await runBuild(defineBuild({ meta: { localPaths: ["../models"] } }), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "x",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "/fake/tsconfig.json",
			writeOutput: () => {},
			writeTargetsBinding: () => "binding",
			readPublishTargets: () => ({ github: "@scope/x" }),
		});
		expect(build).toHaveBeenCalledTimes(1);
		expect(generateMeta).toHaveBeenCalledTimes(1);
		const arg = generateMeta.mock.calls[0]?.[0];
		// No group is named "x", so the canonical group falls back to groups[0] ("github").
		expect(arg?.dtsDir).toContain("github");
		expect(arg?.outMetaDir).toContain("github");
	});

	it("does not call generateMeta for --target prod when meta is unset", async () => {
		const generateMeta = vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		await runBuild(defineBuild({}), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeOutput: () => {},
			writeTargetsBinding: () => "x",
		});
		expect(build).toHaveBeenCalledTimes(1);
		expect(generateMeta).not.toHaveBeenCalled();
	});
});

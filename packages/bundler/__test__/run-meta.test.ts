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
			writeOutput: () => {},
		});
		expect(build).not.toHaveBeenCalled();
		expect(generateMeta).toHaveBeenCalledTimes(1);
		const arg = generateMeta.mock.calls[0]?.[0];
		expect(arg?.dtsDir).toContain("dist/dev");
		expect(arg?.localPaths).toEqual(["../models"]);
	});

	it("does not call generateMeta for --target npm when meta is unset", async () => {
		const generateMeta = vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		await runBuild(defineBuild({}), {
			cwd: "/abs/pkg",
			argv: ["--target", "npm"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeOutput: () => {},
		});
		expect(build).toHaveBeenCalledTimes(1);
		expect(generateMeta).not.toHaveBeenCalled();
	});
});

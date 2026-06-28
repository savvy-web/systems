import type { BuildTargetGroupsOptions } from "@savvy-web/tsdown-plugins";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { build } from "../src/run.js";

let savedArgv: string[];

beforeEach(() => {
	savedArgv = process.argv;
});
afterEach(() => {
	process.argv = savedArgv;
});

describe("build", () => {
	it("derives cwd from the entry script dir and reads flags from process.argv", async () => {
		// Dev path (no --target) avoids prod-only filesystem side effects; --verbose proves argv was parsed.
		process.argv = ["node", "/tmp/some-pkg/savvy.build.ts", "--verbose"];
		let captured: BuildTargetGroupsOptions | undefined;
		await build(
			{ meta: false },
			{
				buildTargetGroups: async (o) => {
					captured = o;
				},
				readVersion: () => "1.2.3",
				readPackageName: () => "some-pkg",
				readExports: () => ({ ".": "./src/index.ts" }),
				readPublishTargets: () => undefined,
				writeTsconfig: () => "/tmp/tsconfig.json",
				writeOutput: () => {},
				writeIssues: () => undefined,
			},
		);
		expect(captured?.cwd).toBe("/tmp/some-pkg");
		expect(captured?.groups).toEqual([{ id: "dev", name: "some-pkg" }]);
		expect(captured?.verbose).toBe(true);
	});
});

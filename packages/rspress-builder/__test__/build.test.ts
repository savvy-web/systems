import type { BuildTargetGroupsOptions } from "@savvy-web/tsdown-plugins";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { build } from "../src/index.js";

let savedArgv: string[];
beforeEach(() => {
	savedArgv = process.argv;
});
afterEach(() => {
	process.argv = savedArgv;
});

describe("build", () => {
	it("derives cwd/argv from process and applies the definePlugin preset", async () => {
		process.argv = ["node", "/tmp/some-plugin/savvy.build.ts", "--verbose"];
		let captured: BuildTargetGroupsOptions | undefined;
		// runtime: false avoids the ./runtime outSubdir override so a minimal exports map suffices.
		// The plugin-bundle externals and define are always emitted regardless of runtime setting.
		await build(
			{ runtime: false },
			{
				buildTargetGroups: async (o) => {
					captured = o;
				},
				readVersion: () => "1.0.0",
				readPackageName: () => "some-plugin",
				readExports: () => ({ ".": "./src/index.ts" }),
				readPublishTargets: () => undefined,
				writeTsconfig: () => "/tmp/tsconfig.json",
				writeOutput: () => {},
				writeIssues: () => undefined,
			},
		);
		expect(captured?.cwd).toBe("/tmp/some-plugin");
		expect(captured?.verbose).toBe(true);
		// definePlugin preset applied: plugin externals + the import.meta.env identity define.
		expect(captured?.externals).toContain("@rspress/core");
		expect(captured?.define?.["import.meta.env"]).toBe("import.meta.env");
	});
});

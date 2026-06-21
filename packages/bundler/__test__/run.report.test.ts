// packages/bundler/__test__/run.report.test.ts

import type { RenderedOutput } from "@savvy-web/tsdown-plugins";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

describe("runBuild report", () => {
	it("renders a non-empty file count from the collector snapshot", async () => {
		const outputs: RenderedOutput[] = [];
		await runBuild(defineBuild({ output: { format: "terminal" } }), {
			cwd: "/tmp/fake-pkg",
			argv: ["--target", "dev"],
			readPackageName: () => "@x/p",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "tsconfig.json",
			// Fake buildTargetGroups that records into the provided collector.
			buildTargetGroups: async (o) => {
				o.collector?.registerGroup(o.groups[0]?.id ?? "dev", ["index"]);
				o.collector?.recordEmitted(o.groups[0]?.id ?? "dev", "js", { path: "index.js", bytes: 60 });
				o.collector?.recordPassTiming(o.groups[0]?.id ?? "dev", "js", 10);
			},
			writeOutput: (out) => outputs.push(out),
		});
		const stdout = outputs.map((o) => o.content).join("\n");
		expect(stdout).toContain("@x/p");
		expect(stdout).toContain("1 files");
		expect(stdout).not.toContain("0 files");
	});
});

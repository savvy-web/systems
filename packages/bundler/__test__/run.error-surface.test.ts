// packages/bundler/__test__/run.error-surface.test.ts
import type { RenderedOutput } from "@savvy-web/tsdown-plugins";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

describe("runBuild error surfacing", () => {
	it("renders collected diagnostics before rethrowing a build failure", async () => {
		const outputs: RenderedOutput[] = [];
		await expect(
			runBuild(defineBuild({ output: { format: "terminal" } }), {
				cwd: "/tmp/fake-pkg",
				argv: ["--target", "dev"],
				readPackageName: () => "@x/p",
				readVersion: () => "1.0.0",
				readExports: () => ({ ".": "./src/index.ts" }),
				writeTsconfig: () => "tsconfig.json",
				buildTargetGroups: async (o) => {
					o.collector?.registerGroup(o.groups[0]?.id ?? "dev", ["index"]);
					o.collector?.recordError(o.groups[0]?.id ?? "dev", { source: "tsdown", level: "error", text: "kaboom" });
					throw new Error("build failed");
				},
				writeOutput: (out) => outputs.push(out),
			}),
		).rejects.toThrow("build failed");
		expect(outputs.map((o) => o.content).join("\n")).toContain("kaboom");
	});
});

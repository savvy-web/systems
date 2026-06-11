// packages/bundler/__test__/run-report.test.ts
import { describe, expect, it } from "vitest";
import { runBuild } from "../src/run.js";

describe("runBuild reporting", () => {
	it("renders a BuildReport using the configured explicit format", async () => {
		const sink: string[] = [];
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "prod"],
				buildTargetGroups: (async () => {}) as never,
				writeOutput: (o) => sink.push(o.content),
				writeTargetsBinding: () => "x",
				readVersion: () => "1.0.0",
				readPackageName: () => "@x/p",
			},
		);
		expect(sink.join("")).toContain("@x/p");
	});
});

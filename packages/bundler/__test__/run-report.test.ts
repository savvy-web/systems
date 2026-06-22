// packages/bundler/__test__/run-report.test.ts
import { describe, expect, it } from "vitest";
import { runBuild } from "../src/run.js";

const baseOptions = {
	cwd: "/abs/pkg",
	buildTargetGroups: (async () => {}) as never,
	writeOutput: (_o: { content: string }) => {},
	writeTargetsBinding: () => "x",
	readVersion: () => "1.0.0",
	readPackageName: () => "@x/p",
	writeIssues: () => "/abs/pkg/dist/prod/issues.json",
} as const;

describe("runBuild reporting", () => {
	it("renders a BuildReport using the configured explicit format", async () => {
		const sink: string[] = [];
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
			{
				...baseOptions,
				argv: ["--target", "prod"],
				writeOutput: (o) => sink.push(o.content),
			},
		);
		expect(sink.join("")).toContain("@x/p");
	});

	it("invokes writeIssues once for a prod build with the package snapshot", async () => {
		const calls: Array<{ cwd: string; target: string; reports: ReadonlyArray<unknown> }> = [];
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
			{
				...baseOptions,
				argv: ["--target", "prod"],
				writeIssues: ({ cwd, target, reports }) => {
					calls.push({ cwd, target, reports });
					return `${cwd}/dist/prod/issues.json`;
				},
			},
		);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.target).toBe("prod");
		expect(Array.isArray(calls[0]?.reports)).toBe(true);
	});

	it("still writes issues.json when the build throws, before rethrowing", async () => {
		const calls: Array<{ target: string }> = [];
		await expect(
			runBuild(
				{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
				{
					...baseOptions,
					argv: ["--target", "prod"],
					buildTargetGroups: (async () => {
						throw new Error("boom");
					}) as never,
					writeIssues: ({ target }) => {
						calls.push({ target });
						return "/abs/pkg/dist/prod/issues.json";
					},
				},
			),
		).rejects.toThrow("boom");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.target).toBe("prod");
	});
});

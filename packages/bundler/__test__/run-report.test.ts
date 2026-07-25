// packages/bundler/__test__/run-report.test.ts
import { describe, expect, it, vi } from "vitest";
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
		const calls: Array<{
			cwd: string;
			target: string;
			reports: ReadonlyArray<unknown>;
			buildOk?: boolean | undefined;
			failure?: unknown;
		}> = [];
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
			{
				...baseOptions,
				argv: ["--target", "prod"],
				writeIssues: ({ cwd, target, reports, buildOk, failure }) => {
					calls.push({ cwd, target, reports, buildOk, failure });
					return `${cwd}/dist/prod/issues.json`;
				},
			},
		);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.target).toBe("prod");
		expect(Array.isArray(calls[0]?.reports)).toBe(true);
		expect(calls[0]?.buildOk).toBe(true);
		expect(calls[0]?.failure).toBeUndefined();
	});

	it("still writes issues.json when the build throws, stamped with the failure, before rethrowing", async () => {
		const calls: Array<{ target: string; buildOk?: boolean | undefined; failure?: unknown }> = [];
		await expect(
			runBuild(
				{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
				{
					...baseOptions,
					argv: ["--target", "prod"],
					buildTargetGroups: (async () => {
						throw new Error("boom");
					}) as never,
					writeIssues: ({ target, buildOk, failure }) => {
						calls.push({ target, buildOk, failure });
						return "/abs/pkg/dist/prod/issues.json";
					},
				},
			),
		).rejects.toThrow("boom");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.target).toBe("prod");
		// Without this stamp the artifact is byte-identical to a clean gate (issue #254).
		expect(calls[0]?.buildOk).toBe(false);
		expect(calls[0]?.failure).toEqual({ name: "Error", message: "boom" });
	});

	it("writes issues.json stamped buildOk:false when setup fails before the build starts", async () => {
		const calls: Array<{ target: string; buildOk?: boolean | undefined; failure?: { message: string } | undefined }> =
			[];
		const buildTargetGroups = vi.fn(async () => {});
		await expect(
			runBuild(
				{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
				{
					...baseOptions,
					argv: ["--target", "prod"],
					buildTargetGroups: buildTargetGroups as never,
					// Dangling `from` — config validation fails long before the build (or the renderer) exists.
					readPublishTargets: () => ({ a: { from: "nope", registry: "https://r" } }),
					writeIssues: ({ target, buildOk, failure }) => {
						calls.push({ target, buildOk, failure });
						return "/abs/pkg/dist/prod/issues.json";
					},
				},
			),
		).rejects.toThrow(/Config validation failed/);
		expect(buildTargetGroups).not.toHaveBeenCalled();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.target).toBe("prod");
		expect(calls[0]?.buildOk).toBe(false);
		expect(calls[0]?.failure?.message).toMatch(/Config validation failed/);
	});

	it("still writes issues.json when the renderer throws on a successful build", async () => {
		const calls: Array<{ buildOk?: boolean | undefined }> = [];
		await expect(
			runBuild(
				{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
				{
					...baseOptions,
					argv: ["--target", "prod"],
					writeOutput: () => {
						throw new Error("render boom");
					},
					writeIssues: ({ buildOk }) => {
						calls.push({ buildOk });
						return "/abs/pkg/dist/prod/issues.json";
					},
				},
			),
		).rejects.toThrow("render boom");
		// The artifact is written BEFORE rendering, so a broken renderer cannot cost us the diagnostics.
		expect(calls).toHaveLength(1);
		expect(calls[0]?.buildOk).toBe(true);
	});

	it("rethrows the original build error, not the renderer error, when both fail", async () => {
		const calls: Array<{ buildOk?: boolean | undefined; failure?: unknown }> = [];
		const thrown = await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", output: { format: "json" }, meta: false },
			{
				...baseOptions,
				argv: ["--target", "prod"],
				buildTargetGroups: (async () => {
					throw new Error("boom");
				}) as never,
				writeOutput: () => {
					throw new Error("render boom");
				},
				writeIssues: ({ buildOk, failure }) => {
					calls.push({ buildOk, failure });
					return "/abs/pkg/dist/prod/issues.json";
				},
			},
		).then(
			() => undefined,
			(e: unknown) => e,
		);
		// Exact match: "render boom" would satisfy a substring assertion on "boom".
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toBe("boom");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.buildOk).toBe(false);
		expect(calls[0]?.failure).toEqual({ name: "Error", message: "boom" });
	});
});

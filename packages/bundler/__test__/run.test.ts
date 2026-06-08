// packages/bundler/__test__/run.test.ts
import type { BuildTargetGroupsOptions } from "@savvy-web/tsdown-plugins";
import { describe, expect, it, vi } from "vitest";
import { runBuild } from "../src/run.js";

describe("runBuild", () => {
	it("maps target dev -> a single dev group spec and invokes buildTargetGroups", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: ["typescript"], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect(spy).toHaveBeenCalledOnce();
		const arg = spy.mock.calls[0][0];
		expect(arg.groups).toEqual([{ id: "dev", name: "base" }]);
		expect(arg.externals).toEqual(["typescript"]);
	});

	it("maps target prod -> a single npm group spec (default, no targets)", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "prod"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
				readPublishTargets: () => undefined,
				writeTargetsBinding: () => "x",
			},
		);
		expect(spy.mock.calls[0][0].groups).toEqual([{ id: "npm", name: "base" }]);
	});

	it("uses the injected writeTsconfig (no temp-dir write) and forwards its path", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		const writeTsconfig = vi.fn<(cwd: string) => string>(() => "/tmp/injected-tsconfig.json");
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{ cwd: "/abs/pkg", argv: ["--target", "dev"], buildTargetGroups: spy, writeTsconfig },
		);
		expect(writeTsconfig).toHaveBeenCalledWith("/abs/pkg");
		expect(spy.mock.calls[0][0].tsconfigPath).toBe("/tmp/injected-tsconfig.json");
	});

	it("infers automatic jsx from tsconfig and forwards it to buildTargetGroups", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
				readTsconfigJsx: () => ({ jsx: "react-jsx", jsxImportSource: "preact" }),
			},
		);
		expect(spy.mock.calls[0][0].jsx).toEqual({ runtime: "automatic", importSource: "preact" });
	});

	it("lets an explicit jsx override win over tsconfig inference", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", jsx: { runtime: "classic" } },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
				readTsconfigJsx: () => ({ jsx: "react-jsx", jsxImportSource: "react" }),
			},
		);
		expect(spy.mock.calls[0][0].jsx).toEqual({ runtime: "classic" });
	});

	it("omits jsx from the build call when neither tsconfig nor config request it", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
				readTsconfigJsx: () => ({}),
			},
		);
		expect(spy.mock.calls[0][0].jsx).toBeUndefined();
	});

	it("forwards format to the build", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", format: ["esm", "cjs"] },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect(spy.mock.calls[0][0].format).toEqual(["esm", "cjs"]);
	});

	it("omits format from the build call when the config does not request it", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect("format" in spy.mock.calls[0][0]).toBe(false);
		expect(spy.mock.calls[0][0].format).toBeUndefined();
	});

	it("forwards bundledPackages to the build", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", bundledPackages: ["@commitlint/types"] },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect(spy.mock.calls[0][0].bundledPackages).toEqual(["@commitlint/types"]);
	});

	it("omits bundledPackages from the build call when the config does not request it", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect("bundledPackages" in spy.mock.calls[0][0]).toBe(false);
		expect(spy.mock.calls[0][0].bundledPackages).toBeUndefined();
	});

	it("forwards bundleNodeModules to the build", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", bundleNodeModules: true },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect(spy.mock.calls[0][0].bundleNodeModules).toBe(true);
	});

	it("omits bundleNodeModules from the build call when the config does not request it", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect("bundleNodeModules" in spy.mock.calls[0][0]).toBe(false);
		expect(spy.mock.calls[0][0].bundleNodeModules).toBeUndefined();
	});

	it("forwards dtsExternals to the build", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve", dtsExternals: ["effect", "@effect/platform"] },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect(spy.mock.calls[0][0].dtsExternals).toEqual(["effect", "@effect/platform"]);
	});

	it("omits dtsExternals from the build call when the config does not request it", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "dev"],
				buildTargetGroups: spy,
				writeTsconfig: () => "/tmp/fake-tsconfig.json",
				readPackageName: () => "base",
			},
		);
		expect("dtsExternals" in spy.mock.calls[0][0]).toBe(false);
		expect(spy.mock.calls[0][0].dtsExternals).toBeUndefined();
	});
});

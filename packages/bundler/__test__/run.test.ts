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

	it("maps target npm -> a single npm group spec (default, no targets)", async () => {
		const spy = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(
			{ formats: ["esm"], externals: [], devManifest: "preserve" },
			{
				cwd: "/abs/pkg",
				argv: ["--target", "npm"],
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
});

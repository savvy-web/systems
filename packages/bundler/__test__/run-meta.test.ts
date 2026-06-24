import type { BuildTargetGroupsOptions } from "@savvy-web/tsdown-plugins";
import { describe, expect, it, vi } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

describe("runBuild meta target", () => {
	it("--target meta is a deprecated no-op (does not run generateMeta or a build)", async () => {
		const generateMeta = vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		const out: string[] = [];
		await runBuild(defineBuild({ meta: { localPaths: ["../models"] } }), {
			cwd: "/abs/pkg",
			argv: ["--target", "meta"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "/fake/tsconfig.json",
			writeOutput: (o) => out.push(o.content),
		});
		expect(generateMeta).not.toHaveBeenCalled();
		expect(build).not.toHaveBeenCalled();
		expect(out.join("\n")).toMatch(/deprecated/i);
	});

	it("--target meta is a no-op even when meta: false (unified deprecation path)", async () => {
		const generateMeta = vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		const out: string[] = [];
		await runBuild(defineBuild({ meta: false }), {
			cwd: "/abs/pkg",
			argv: ["--target", "meta"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "/fake/tsconfig.json",
			writeOutput: (o) => out.push(o.content),
		});
		expect(generateMeta).not.toHaveBeenCalled();
		expect(build).not.toHaveBeenCalled();
		expect(out.join("\n")).toMatch(/deprecated/i);
	});

	it("falls back to the first group's dir for meta when no group is named after the package", async () => {
		const generateMeta = vi.fn<
			(o: { dtsDir: string; outMetaDir: string }) => Promise<{ apiJsonPath: string; apiJsonFilename: string }>
		>(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		await runBuild(defineBuild({ meta: { localPaths: ["../models"] } }), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "x",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "/fake/tsconfig.json",
			writeOutput: () => {},
			writeTargetsBinding: () => "binding",
			readPublishTargets: () => ({ github: "@scope/x" }),
		});
		expect(build).toHaveBeenCalledTimes(1);
		expect(generateMeta).toHaveBeenCalledTimes(1);
		const arg = generateMeta.mock.calls[0]?.[0];
		// No group is named "x", so the canonical group falls back to groups[0] ("github").
		expect(arg?.dtsDir).toContain("github");
		expect(arg?.outMetaDir).toContain("github");
	});

	it("calls generateMeta for --target prod when meta is unset (default-on)", async () => {
		const generateMeta = vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		await runBuild(defineBuild({}), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeOutput: () => {},
			writeTargetsBinding: () => "x",
		});
		expect(build).toHaveBeenCalledTimes(1);
		expect(generateMeta).toHaveBeenCalledTimes(1);
	});

	it("does not call generateMeta for --target prod when meta is false", async () => {
		const generateMeta = vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" }));
		const build = vi.fn(async () => {});
		await runBuild(defineBuild({ meta: false }), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeOutput: () => {},
			writeTargetsBinding: () => "x",
		});
		expect(build).toHaveBeenCalledTimes(1);
		expect(generateMeta).not.toHaveBeenCalled();
	});

	it("--target prod runs generateMeta once per prod group, canonical group gets localPaths", async () => {
		const calls: Array<{ dtsDir: string; outMetaDir: string; localPaths: ReadonlyArray<string> }> = [];
		const generateMeta = vi.fn(async (o: { dtsDir: string; outMetaDir: string; localPaths: ReadonlyArray<string> }) => {
			calls.push({ dtsDir: o.dtsDir, outMetaDir: o.outMetaDir, localPaths: o.localPaths });
			return { apiJsonPath: "x", apiJsonFilename: "x" };
		});
		const build = vi.fn(async () => {});
		await runBuild(defineBuild({ meta: { localPaths: ["../models"] } }), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: build,
			generateMeta,
			readPackageName: () => "@scope/pkg",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "/fake/tsconfig.json",
			writeOutput: () => {},
			writeTargetsBinding: () => "binding",
			// npm (true, name=@scope/pkg) + github (renamed) => two groups.
			readPublishTargets: () => ({ npm: true, github: "@scope/pkg-gh" }),
			resolveNextVersions: async () => ({ root: "/abs", versions: new Map() }),
		});
		expect(generateMeta).toHaveBeenCalledTimes(2);
		const npm = calls.find((c) => c.outMetaDir.includes("/npm/"));
		const gh = calls.find((c) => c.outMetaDir.includes("/github/"));
		expect(npm?.localPaths).toEqual(["../models"]); // canonical (name matches @scope/pkg)
		expect(gh?.localPaths).toEqual([]); // non-canonical: no localPaths copy
	});

	it("--target prod passes a manifestTransform when optimistic resolves true", async () => {
		let transformApplied: Record<string, unknown> | undefined;
		const generateMeta = vi.fn(
			async (o: { manifestTransform?: ((p: Record<string, unknown>) => Record<string, unknown>) | undefined }) => {
				transformApplied = o.manifestTransform?.({ name: "@scope/pkg", version: "0.0.0" });
				return { apiJsonPath: "x", apiJsonFilename: "x" };
			},
		);
		await runBuild(defineBuild({ meta: { optimistic: true } }), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: vi.fn(async () => {}),
			generateMeta,
			readPackageName: () => "@scope/pkg",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "/fake/tsconfig.json",
			writeOutput: () => {},
			writeTargetsBinding: () => "binding",
			resolveNextVersions: async () => ({ root: "/abs", versions: new Map([["@scope/pkg", "1.0.0"]]) }),
		});
		expect(transformApplied?.version).toBe("1.0.0");
	});

	it("--target prod does not resolve next versions when optimistic is false", async () => {
		const resolveNextVersions = vi.fn(async () => ({ root: "/abs", versions: new Map() }));
		const generateMeta = vi.fn(async (o: { manifestTransform?: unknown }) => {
			expect(o.manifestTransform).toBeUndefined();
			return { apiJsonPath: "x", apiJsonFilename: "x" };
		});
		await runBuild(defineBuild({ meta: { optimistic: false } }), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: vi.fn(async () => {}),
			generateMeta,
			readPackageName: () => "@scope/pkg",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeTsconfig: () => "/fake/tsconfig.json",
			writeOutput: () => {},
			writeTargetsBinding: () => "binding",
			resolveNextVersions,
		});
		expect(resolveNextVersions).not.toHaveBeenCalled();
	});

	it("--target prod sets emitDeclarations: true on the buildTargetGroups call", async () => {
		const build = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(defineBuild({}), {
			cwd: "/abs/pkg",
			argv: ["--target", "prod"],
			buildTargetGroups: build,
			generateMeta: vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" })),
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeOutput: () => {},
			writeTargetsBinding: () => "binding",
		});
		expect(build).toHaveBeenCalledTimes(1);
		const buildOpts = build.mock.calls[0]?.[0];
		expect(buildOpts.emitDeclarations).toBe(true);
	});

	it("--target dev does NOT set emitDeclarations on the buildTargetGroups call", async () => {
		const build = vi.fn<(o: BuildTargetGroupsOptions) => Promise<void>>(async () => {});
		await runBuild(defineBuild({}), {
			cwd: "/abs/pkg",
			argv: ["--target", "dev"],
			buildTargetGroups: build,
			generateMeta: vi.fn(async () => ({ apiJsonPath: "x", apiJsonFilename: "x" })),
			readPackageName: () => "@scope/fixture",
			readVersion: () => "1.0.0",
			readExports: () => ({ ".": "./src/index.ts" }),
			writeOutput: () => {},
		});
		expect(build).toHaveBeenCalledTimes(1);
		const buildOpts = build.mock.calls[0]?.[0];
		expect(buildOpts.emitDeclarations).toBeUndefined();
	});
});

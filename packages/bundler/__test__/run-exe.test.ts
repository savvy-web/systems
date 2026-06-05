// packages/bundler/__test__/run-exe.test.ts
import type { RunExeBuildOptions } from "@savvy-web/tsdown-plugins";
import { describe, expect, it, vi } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

const base = {
	readVersion: () => "1.0.0",
	readPackageName: () => "tool",
	readExports: () => ({ ".": "./src/bin.ts" }),
	writeTsconfig: (c: string) => `${c}/tsconfig.json`,
	writeOutput: () => {},
};

describe("runBuild --target exe", () => {
	it("normalizes exe config and calls runExeBuild with one spec per binary", async () => {
		const runExeBuild = vi.fn<(o: RunExeBuildOptions) => Promise<void>>(async () => {});
		const buildTargetGroups = vi.fn(async () => {});
		await runBuild(defineBuild({ exe: { fileName: "tool", entry: "./src/bin.ts" } }), {
			cwd: "/abs/pkg",
			argv: ["--target", "exe"],
			runExeBuild,
			buildTargetGroups,
			readOsCpu: () => ({ os: ["darwin"], cpu: ["arm64"] }),
			...base,
		});
		expect(buildTargetGroups).not.toHaveBeenCalled();
		expect(runExeBuild).toHaveBeenCalledTimes(1);
		const opts = runExeBuild.mock.calls[0][0];
		expect(opts.specs[0]?.fileName).toBe("tool");
		expect(opts.specs[0]?.targets[0]?.platform).toBe("darwin");
		expect(opts.outDir).toBe("/abs/pkg/dist/dev/pkg/bin");
		expect(opts.cwd).toBe("/abs/pkg");
	});

	it("throws when --target exe is requested but no exe option is configured", async () => {
		await expect(
			runBuild(defineBuild({}), { cwd: "/abs/pkg", argv: ["--target", "exe"], runExeBuild: vi.fn(), ...base }),
		).rejects.toThrow(/requires an `exe` option/);
	});
});

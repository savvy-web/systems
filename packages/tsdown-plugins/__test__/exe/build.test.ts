import { describe, expect, it, vi } from "vitest";
import { runExeBuild } from "../../src/exe/build.js";

describe("runExeBuild", () => {
	it("calls the injected build once per binary with the SEA exe config", async () => {
		const build = vi.fn(async () => {});
		await runExeBuild({
			cwd: "/abs/pkg",
			outDir: "/abs/pkg/dist/dev/pkg/bin",
			specs: [
				{
					fileName: "tool",
					entry: "./src/bin.ts",
					targets: [{ platform: "darwin", arch: "arm64", nodeVersion: "25.9.0" }],
					seaConfig: { disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false },
				},
			],
			build,
		});
		expect(build).toHaveBeenCalledTimes(1);
		const cfg = (build.mock.calls[0] as unknown as [unknown])[0] as {
			cwd: string;
			entry: string[];
			format: string;
			platform: string;
			deps: { alwaysBundle: (id: string) => boolean };
			exe: { fileName: string; outDir: string; targets: unknown; seaConfig: unknown };
		};
		expect(cfg.cwd).toBe("/abs/pkg");
		expect(cfg.entry).toEqual(["./src/bin.ts"]);
		expect(cfg.format).toBe("esm");
		expect(cfg.platform).toBe("node");
		expect(cfg.exe.fileName).toBe("tool");
		expect(cfg.exe.outDir).toBe("/abs/pkg/dist/dev/pkg/bin");
		expect(cfg.exe.targets).toEqual([{ platform: "darwin", arch: "arm64", nodeVersion: "25.9.0" }]);
		expect(cfg.exe.seaConfig).toEqual({ disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false });
		// alwaysBundle: bundle everything except node: builtins
		expect(cfg.deps.alwaysBundle("node:fs")).toBe(false);
		expect(cfg.deps.alwaysBundle("some-dep")).toBe(true);
	});

	it("builds once per spec for a multi-binary config", async () => {
		const build = vi.fn(async () => {});
		await runExeBuild({
			cwd: "/abs/pkg",
			outDir: "/abs/pkg/bin",
			specs: [
				{
					fileName: "a",
					entry: "./src/a.ts",
					targets: [{ platform: "linux", arch: "x64", nodeVersion: "25.9.0" }],
					seaConfig: { disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false },
				},
				{
					fileName: "b",
					entry: "./src/b.ts",
					targets: [{ platform: "linux", arch: "arm64", nodeVersion: "25.9.0" }],
					seaConfig: { disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false },
				},
			],
			build,
		});
		expect(build).toHaveBeenCalledTimes(2);
		const c0 = (build.mock.calls[0] as unknown as [unknown])[0] as {
			entry: string[];
			exe: { fileName: string; targets: Array<{ platform: string }> };
		};
		const c1 = (build.mock.calls[1] as unknown as [unknown])[0] as {
			entry: string[];
			exe: { fileName: string; targets: Array<{ platform: string }> };
		};
		expect(c0.entry).toEqual(["./src/a.ts"]);
		expect(c0.exe.fileName).toBe("a");
		expect(c1.entry).toEqual(["./src/b.ts"]);
		expect(c1.exe.fileName).toBe("b");
	});
});

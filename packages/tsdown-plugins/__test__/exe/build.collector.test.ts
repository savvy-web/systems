// packages/tsdown-plugins/__test__/exe/build.collector.test.ts
import { describe, expect, it } from "vitest";
import { runExeBuild } from "../../src/exe/build.js";
import type { NormalizedExe } from "../../src/exe/config.js";
import { BuildCollector } from "../../src/report/collector.js";

const spec: NormalizedExe = {
	entry: "./src/bin.ts",
	fileName: "tool",
	seaConfig: {},
	targets: [{ os: "linux", cpu: "x64", node: "24" }],
} as unknown as NormalizedExe;

describe("runExeBuild collector wiring", () => {
	it("muzzles tsdown and records an exe pass timing", async () => {
		const c = new BuildCollector();
		c.registerGroup("npm", []);
		const configs: Array<Record<string, unknown>> = [];
		await runExeBuild({
			cwd: "/tmp/x",
			outDir: "/tmp/x/bin",
			specs: [spec],
			collector: c,
			groupId: "npm",
			verbose: false,
			build: async (config) => {
				configs.push(config as Record<string, unknown>);
				return undefined;
			},
		});
		expect(configs[0]?.logLevel).toBe("silent");
		const [report] = c.snapshot("@x/p");
		expect(report?.targetGroups[0]?.passes.find((p) => p.id === "exe")).toBeDefined();
	});
});

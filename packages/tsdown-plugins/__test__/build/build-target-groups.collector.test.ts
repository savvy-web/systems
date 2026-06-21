// packages/tsdown-plugins/__test__/build/build-target-groups.collector.test.ts
import { describe, expect, it } from "vitest";
import { buildTargetGroups } from "../../src/build/build-target-groups.js";
import { BuildCollector } from "../../src/report/collector.js";

describe("buildTargetGroups collector wiring", () => {
	it("muzzles tsdown and records per-pass timing when a collector is provided", async () => {
		const c = new BuildCollector();
		const configs: Array<Record<string, unknown>> = [];
		const fakeBuild = async (config: Record<string, unknown>): Promise<unknown> => {
			configs.push(config);
			return undefined;
		};
		await buildTargetGroups({
			cwd: "/tmp/x",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "tsconfig.json",
			groups: [{ id: "npm", name: "@x/p" }],
			devManifest: "preserve",
			collector: c,
			verbose: false,
			build: fakeBuild,
		});
		// Every build() config is muzzled with silent + a customLogger.
		expect(configs.length).toBeGreaterThanOrEqual(2);
		for (const cfg of configs) {
			expect(cfg.logLevel).toBe("silent");
			expect(cfg.customLogger).toBeDefined();
		}
		const [report] = c.snapshot("@x/p");
		const group = report?.targetGroups[0];
		expect(group?.id).toBe("npm");
		expect(group?.passes.map((p) => p.id).sort()).toEqual(["dts", "js"]);
	});

	it("leaves tsdown output untouched when no collector is provided", async () => {
		const configs: Array<Record<string, unknown>> = [];
		const fakeBuild = async (config: Record<string, unknown>): Promise<unknown> => {
			configs.push(config);
			return undefined;
		};
		await buildTargetGroups({
			cwd: "/tmp/x",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "tsconfig.json",
			groups: [{ id: "dev", name: "@x/p" }],
			devManifest: "preserve",
			build: fakeBuild,
		});
		for (const cfg of configs) expect(cfg.logLevel).toBeUndefined();
	});
});

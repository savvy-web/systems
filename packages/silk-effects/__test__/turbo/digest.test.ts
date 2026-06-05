import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { TurboDigest } from "../../src/turbo/digest.js";
import { TurboDryRun } from "../../src/turbo/schemas/DryRun.js";

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/dry-run.json"), "utf-8")) as unknown;

describe("TurboDryRun schema", () => {
	it("decodes a real dry-run payload", () => {
		const decoded = Schema.decodeUnknownSync(TurboDryRun)(fixture);
		expect(decoded.tasks).toHaveLength(2);
		expect(decoded.tasks[0].cache.status).toBe("HIT");
		expect(decoded.tasks[1].cache.status).toBe("MISS");
		expect(decoded.globalCacheInputs.rootKey).toBe("fixture-root-key");
	});
});

describe("TurboDigest.cacheDiagnosis", () => {
	const decoded = Schema.decodeUnknownSync(TurboDryRun)(fixture);

	it("counts hits and misses", () => {
		const d = TurboDigest.cacheDiagnosis("build:dev", decoded);
		expect(d.totalTasks).toBe(2);
		expect(d.hits).toBe(1);
		expect(d.misses).toBe(1);
	});

	it("explains only the misses, with hash contributors", () => {
		const d = TurboDigest.cacheDiagnosis("build:dev", decoded);
		expect(d.explanations).toHaveLength(1);
		const miss = d.explanations[0];
		expect(miss.package).toBe("@savvy-web/bundler");
		expect(miss.inputFileCount).toBe(1);
		expect(miss.hashedEnvVars).toContain("NODE_ENV");
		expect(miss.dependsOn).toEqual(["@savvy-web/tsdown-plugins#build:dev"]);
	});

	it("summarizes the global hash", () => {
		const d = TurboDigest.cacheDiagnosis("build:dev", decoded);
		expect(d.global.rootKey).toBe("fixture-root-key");
		expect(d.global.globalFileCount).toBe(1);
		expect(d.global.globalEnvVars).toContain("CI");
	});
});

describe("TurboDigest.taskGraph", () => {
	const decoded = Schema.decodeUnknownSync(TurboDryRun)(fixture);

	it("builds nodes and computes the critical path", () => {
		const g = TurboDigest.taskGraph(decoded, "build:dev");
		expect(g.nodeCount).toBe(2);
		expect(g.criticalPath).toEqual(["@savvy-web/tsdown-plugins#build:dev", "@savvy-web/bundler#build:dev"]);
	});

	it("omits the task key when called without a task argument", () => {
		const g = TurboDigest.taskGraph(decoded);
		expect(g).not.toHaveProperty("task");
		expect(g.nodeCount).toBe(2);
	});
});

describe("TurboDigest.affected", () => {
	const decoded = Schema.decodeUnknownSync(TurboDryRun)(fixture);

	it("identifies direct dependents of changed packages", () => {
		const r = TurboDigest.affected("main", ["@savvy-web/tsdown-plugins"], decoded);
		expect(r.packages).toEqual(["@savvy-web/tsdown-plugins"]);
		expect(r.dependents).toContain("@savvy-web/bundler");
		expect(r.dependents).not.toContain("@savvy-web/tsdown-plugins");
	});

	it("returns empty sets when changed is empty", () => {
		const r = TurboDigest.affected("main", [], decoded);
		expect(r.packages).toEqual([]);
		expect(r.dependents).toEqual([]);
	});
});

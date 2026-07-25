import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
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

	it("summarizes the global hash, excluding pass-through env vars", () => {
		const d = TurboDigest.cacheDiagnosis("build:dev", decoded);
		expect(d.global.rootKey).toBe("fixture-root-key");
		expect(d.global.globalFileCount).toBe(1);
		// configured/inferred env contribute to the hash; pass-through vars do not.
		expect(d.global.globalEnvVars).toContain("NODE_ENV");
		expect(d.global.globalEnvVars).not.toContain("CI");
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

	it("splits directly-changed packages from dependents using changed file paths", () => {
		// A file under tsdown-plugins changed; bundler is in the affected set only as a dependent.
		const r = TurboDigest.affected("main", ["packages/tsdown-plugins/src/index.ts"], decoded);
		expect(r.packages).toEqual(["@savvy-web/tsdown-plugins"]);
		expect(r.dependents).toEqual(["@savvy-web/bundler"]);
	});

	it("reports the whole affected set as dependents when the change is outside any package", () => {
		// A root-level change (e.g. the lockfile) makes the graph affected but no package directly changed.
		const r = TurboDigest.affected("main", ["pnpm-lock.yaml"], decoded);
		expect(r.packages).toEqual([]);
		expect(r.dependents).toEqual(["@savvy-web/tsdown-plugins", "@savvy-web/bundler"]);
	});

	it("treats an empty change set as no directly-changed packages", () => {
		const r = TurboDigest.affected("main", [], decoded);
		expect(r.packages).toEqual([]);
		expect(r.dependents).toEqual(["@savvy-web/tsdown-plugins", "@savvy-web/bundler"]);
	});
});

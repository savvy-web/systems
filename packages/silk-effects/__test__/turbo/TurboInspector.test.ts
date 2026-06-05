import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { TurboDigest } from "../../src/turbo/digest.js";
import { TurboDryRun } from "../../src/turbo/schemas/DryRun.js";
import { TurboInspector } from "../../src/turbo/services/TurboInspector.js";

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/dry-run.json"), "utf-8")) as unknown;
const decoded = Schema.decodeUnknownSync(TurboDryRun)(fixture);

const TurboInspectorTest = Layer.succeed(
	TurboInspector,
	TurboInspector.of({
		diagnoseCache: (task, _cwd) => Effect.succeed(TurboDigest.cacheDiagnosis(task, decoded)),
		taskGraph: (_cwd, task) => Effect.succeed(TurboDigest.taskGraph(decoded, task)),
		affected: (_cwd, base) => Effect.succeed(TurboDigest.affected(base ?? "HEAD", [], decoded)),
	}),
);

const run = <A, E>(eff: Effect.Effect<A, E, TurboInspector>) =>
	Effect.runPromise(eff.pipe(Effect.provide(TurboInspectorTest)));

describe("TurboInspector (test layer)", () => {
	it("diagnoseCache returns hit/miss counts", async () => {
		const d = await run(Effect.flatMap(TurboInspector, (t) => t.diagnoseCache("build:dev", "/repo")));
		expect(d.hits).toBe(1);
		expect(d.misses).toBe(1);
	});

	it("taskGraph returns the critical path", async () => {
		const g = await run(Effect.flatMap(TurboInspector, (t) => t.taskGraph("/repo", "build:dev")));
		expect(g.criticalPath.at(-1)).toBe("@savvy-web/bundler#build:dev");
	});
});

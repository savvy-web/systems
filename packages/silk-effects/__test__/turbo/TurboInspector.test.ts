import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
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

layer(TurboInspectorTest)("TurboInspector (test layer)", (it) => {
	it.effect("diagnoseCache returns hit/miss counts", () =>
		Effect.gen(function* () {
			const d = yield* Effect.flatMap(TurboInspector, (t) => t.diagnoseCache("build:dev", "/repo"));
			expect(d.hits).toBe(1);
			expect(d.misses).toBe(1);
		}),
	);

	it.effect("taskGraph returns the critical path", () =>
		Effect.gen(function* () {
			const g = yield* Effect.flatMap(TurboInspector, (t) => t.taskGraph("/repo", "build:dev"));
			expect(g.criticalPath.at(-1)).toBe("@savvy-web/bundler#build:dev");
		}),
	);
});

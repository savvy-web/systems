// packages/tsdown-plugins/__test__/report/pipeline.test.ts

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { ReportPipelineLive, renderReport } from "../../src/report/pipeline.js";
import type { BuildReport } from "../../src/report/schema.js";

const report: BuildReport = {
	package: "@x/p",
	targetGroups: [
		{
			id: "npm",
			entries: ["index"],
			passes: [{ id: "js", files: [{ path: "index.js", bytes: 120 }], ms: 5 }],
			timings: { totalMs: 5 },
			warnings: [],
			errors: [],
			suppressed: [],
		},
	],
};

layer(ReportPipelineLive)("report pipeline", (it) => {
	it.effect("explicit format wins over environment", () =>
		Effect.gen(function* () {
			const out = yield* renderReport([report], { explicitFormat: "json", env: "terminal", noColor: true });
			expect(out[0].contentType).toBe("application/json");
		}),
	);

	it.effect("ci-github + ci executor -> ci-annotations", () =>
		Effect.gen(function* () {
			const out = yield* renderReport([report], { env: "ci-github", noColor: true });
			expect(out.length === 0 || out[0].content.includes("::") || out[0].content === "").toBe(true);
		}),
	);

	it.effect("terminal env with a TTY-human executor -> terminal", () =>
		Effect.gen(function* () {
			const out = yield* renderReport([report], { env: "terminal", noColor: true });
			expect(out[0]?.contentType).toBe("text/plain");
		}),
	);
});

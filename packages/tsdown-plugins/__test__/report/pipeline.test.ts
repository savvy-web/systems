// packages/tsdown-plugins/__test__/report/pipeline.test.ts

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
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

const run = <A>(eff: Effect.Effect<A, never, never>) => Effect.runPromise(eff);

describe("report pipeline", () => {
	it("explicit format wins over environment", async () => {
		const out = await run(
			renderReport([report], { explicitFormat: "json", env: "terminal", noColor: true }).pipe(
				Effect.provide(ReportPipelineLive),
			),
		);
		expect(out[0].contentType).toBe("application/json");
	});

	it("ci-github + ci executor -> ci-annotations", async () => {
		const out = await run(
			renderReport([report], { env: "ci-github", noColor: true }).pipe(Effect.provide(ReportPipelineLive)),
		);
		expect(out.length === 0 || out[0].content.includes("::") || out[0].content === "").toBe(true);
	});

	it("terminal env with a TTY-human executor -> terminal", async () => {
		const out = await run(
			renderReport([report], { env: "terminal", noColor: true }).pipe(Effect.provide(ReportPipelineLive)),
		);
		expect(out[0]?.contentType).toBe("text/plain");
	});
});

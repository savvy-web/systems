// packages/tsdown-plugins/__test__/report/pipeline.test.ts

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { ReportPipeline, renderReport } from "../../src/report/pipeline.js";
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

const reportWithDiagnostics: BuildReport = {
	package: "@x/p",
	targetGroups: [
		{
			id: "npm",
			entries: ["index"],
			passes: [{ id: "js", files: [{ path: "index.js", bytes: 120 }], ms: 5 }],
			timings: { totalMs: 5 },
			warnings: [{ source: "tsdown", level: "warn", text: "unused export", file: "src/index.ts", line: 12 }],
			errors: [{ source: "tsdown", level: "error", text: "forgotten export", file: "src/thing.ts", line: 3 }],
			suppressed: [],
		},
	],
};

layer(ReportPipeline)("report pipeline", (it) => {
	it.effect("explicit format wins over environment", () =>
		Effect.gen(function* () {
			const out = yield* renderReport([report], { explicitFormat: "json", env: "terminal", noColor: true });
			expect(out[0].contentType).toBe("application/json");
		}),
	);

	it.effect("ci-github + ci executor -> ci-annotations", () =>
		Effect.gen(function* () {
			const out = yield* renderReport([reportWithDiagnostics], { env: "ci-github", noColor: true });
			expect(out).toHaveLength(1);
			expect(out[0].target).toBe("stdout");
			expect(out[0].contentType).toBe("text/plain");
			expect(out[0].content).toContain("::error title=@x/p (npm) file=src/thing.ts,line=3::forgotten export");
			expect(out[0].content).toContain("::warning title=@x/p (npm) file=src/index.ts,line=12::unused export");
		}),
	);

	it.effect("terminal env with a TTY-human executor -> terminal", () =>
		Effect.gen(function* () {
			const out = yield* renderReport([report], { env: "terminal", noColor: true });
			expect(out[0]?.contentType).toBe("text/plain");
		}),
	);
});

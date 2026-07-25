// packages/tsdown-plugins/__test__/report/schema.test.ts

import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { BuildReport, DiagnosticEntry } from "../../src/report/schema.js";

describe("BuildReport schema", () => {
	it("decodes a report with passes, files, and structured diagnostics", () => {
		const decoded = Schema.decodeUnknownSync(BuildReport)({
			package: "@x/p",
			targetGroups: [
				{
					id: "npm",
					entries: ["index"],
					passes: [
						{ id: "js", files: [{ path: "index.js", bytes: 60 }], ms: 731 },
						{ id: "dts", files: [{ path: "index.d.ts", bytes: 2400, gzip: 890 }], ms: 205 },
					],
					warnings: [{ source: "tsdown", level: "warn", text: "heads up" }],
					errors: [],
					suppressed: [],
					timings: { totalMs: 936 },
				},
			],
		});
		expect(decoded.targetGroups[0]?.passes).toHaveLength(2);
		expect(decoded.targetGroups[0]?.passes[0]?.files[0]?.bytes).toBe(60);
	});

	it("rejects an unknown diagnostic source and decodes a structured entry", () => {
		// An out-of-enum source is rejected by the DiagnosticEntry schema.
		expect(() => Schema.decodeUnknownSync(DiagnosticEntry)({ source: "nope", level: "warn", text: "x" })).toThrow();
		// A full entry with file/line/column round-trips.
		const entry: DiagnosticEntry = Schema.decodeUnknownSync(DiagnosticEntry)({
			source: "api-extractor",
			level: "error",
			text: "boom",
			file: "a.ts",
			line: 3,
			column: 1,
		});
		expect(entry.file).toBe("a.ts");
	});
});

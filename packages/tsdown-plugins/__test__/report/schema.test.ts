// packages/tsdown-plugins/__test__/report/schema.test.ts

import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { BuildReport } from "../../src/report/schema.js";

describe("BuildReport schema", () => {
	it("decodes a minimal valid report", () => {
		const decode = Schema.decodeUnknownSync(BuildReport);
		const report = decode({
			package: "@x/p",
			targetGroups: [
				{
					id: "npm",
					entries: ["index"],
					emittedFiles: ["index.js", "index.d.ts"],
					timings: { totalMs: 12 },
					warnings: [],
					errors: [],
				},
			],
		});
		expect(report.package).toBe("@x/p");
		expect(report.targetGroups[0].emittedFiles).toContain("index.d.ts");
	});

	it("rejects a report missing required fields", () => {
		expect(() => Schema.decodeUnknownSync(BuildReport)({ package: "@x/p" })).toThrow();
	});
});

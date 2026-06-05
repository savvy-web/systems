// packages/tsdown-plugins/__test__/report/formatters.test.ts
import { describe, expect, it } from "vitest";
import {
	CiAnnotationsFormatter,
	JsonFormatter,
	MarkdownFormatter,
	SilentFormatter,
	TerminalFormatter,
} from "../../src/report/formatters/index.js";
import type { BuildReport } from "../../src/report/schema.js";

const report: BuildReport = {
	package: "@x/p",
	targetGroups: [
		{
			id: "npm",
			entries: ["index"],
			emittedFiles: ["index.js", "index.d.ts"],
			timings: { totalMs: 12 },
			warnings: [],
			errors: ["boom"],
		},
	],
};
const ctx = { noColor: true };

describe("formatters", () => {
	it("json round-trips the report", () => {
		const out = JsonFormatter.render([report], ctx);
		expect(out[0].target).toBe("stdout");
		expect(out[0].contentType).toBe("application/json");
		expect(JSON.parse(out[0].content)[0].package).toBe("@x/p");
	});

	it("terminal renders plain text with the package name", () => {
		const out = TerminalFormatter.render([report], ctx);
		expect(out[0].content).toContain("@x/p");
		expect(out[0].contentType).toBe("text/plain");
	});

	it("markdown is failures-first (errors surfaced)", () => {
		const out = MarkdownFormatter.render([report], ctx);
		expect(out[0].content).toContain("boom");
	});

	it("ci-annotations emits ::error", () => {
		const out = CiAnnotationsFormatter.render([report], ctx);
		expect(out[0].content).toContain("::error");
	});

	it("silent renders nothing", () => {
		expect(SilentFormatter.render([report], ctx)).toEqual([]);
	});
});

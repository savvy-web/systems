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
			passes: [
				{
					id: "js",
					files: [
						{ path: "index.js", bytes: 60 },
						{ path: "lib/greeter.js", bytes: 2340 },
					],
					ms: 731,
				},
				{ id: "dts", files: [{ path: "index.d.ts", bytes: 2400, gzip: 890 }], ms: 205 },
			],
			warnings: [{ source: "tsdown", level: "warn", text: "heads up" }],
			errors: [{ source: "api-extractor", level: "error", text: "boom", file: "a.ts", line: 3, column: 1 }],
			timings: { totalMs: 936 },
		},
	],
};
const ctx = { noColor: true, verbose: false };

describe("formatters", () => {
	it("json round-trips the report", () => {
		const out = JsonFormatter.render([report], ctx);
		expect(JSON.parse(out[0].content)[0].package).toBe("@x/p");
	});

	it("terminal quiet shows one line per group with file count and time", () => {
		const out = TerminalFormatter.render([report], ctx);
		expect(out[0].content).toContain("@x/p");
		expect(out[0].content).toContain("3 files");
		expect(out[0].content).toContain("936ms");
		expect(out[0].content).toContain("heads up");
		expect(out[0].content).toContain("boom");
		// quiet output does NOT list individual files
		expect(out[0].content).not.toContain("lib/greeter.js");
	});

	it("terminal verbose lists per-pass files", () => {
		const out = TerminalFormatter.render([report], { noColor: true, verbose: true });
		expect(out[0].content).toContain("lib/greeter.js");
		expect(out[0].content).toContain("index.d.ts");
	});

	it("markdown surfaces error text", () => {
		const out = MarkdownFormatter.render([report], ctx);
		expect(out[0].content).toContain("boom");
	});

	it("ci-annotations emits ::error with file/line", () => {
		const out = CiAnnotationsFormatter.render([report], ctx);
		expect(out[0].content).toContain("::error");
		expect(out[0].content).toContain("a.ts");
	});

	it("silent renders nothing", () => {
		expect(SilentFormatter.render([report], ctx)).toEqual([]);
	});
});

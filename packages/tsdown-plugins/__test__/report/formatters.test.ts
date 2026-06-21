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
			suppressed: [],
			timings: { totalMs: 936 },
		},
	],
};
const ctx = { noColor: true, verbose: false };

const fatalReport: BuildReport = {
	package: "@x/p",
	targetGroups: [
		{
			id: "npm",
			entries: ["index"],
			passes: [],
			warnings: [
				{
					source: "api-extractor",
					level: "warn",
					text: "Bar needs export",
					code: "ae-forgotten-export",
					ciFatal: true,
				},
			],
			errors: [],
			suppressed: [
				{ source: "api-extractor", level: "warn", text: "X needs export", code: "ae-forgotten-export" },
				{ source: "api-extractor", level: "warn", text: "Y undocumented", code: "tsdoc-undefined-tag" },
				{ source: "api-extractor", level: "warn", text: "Z needs export", code: "ae-forgotten-export" },
			],
			timings: { totalMs: 5 },
		},
	],
};

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

	it("terminal tags ci-fatal warnings and summarizes suppressed by code", () => {
		const out = TerminalFormatter.render([fatalReport], ctx);
		expect(out[0].content).toContain("[fails CI]");
		expect(out[0].content).toContain("suppressed 3:");
		expect(out[0].content).toContain("ae-forgotten-export ×2");
		expect(out[0].content).toContain("tsdoc-undefined-tag ×1");
		expect(out[0].content).toContain("hard error in CI");
	});

	it("terminal --verbose expands the suppressed list instead of the summary", () => {
		const out = TerminalFormatter.render([fatalReport], { noColor: true, verbose: true });
		expect(out[0].content).toContain("Y undocumented");
		expect(out[0].content).not.toContain("suppressed 3:");
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

	it("markdown surfaces warning text (not just errors)", () => {
		const warnOnly: BuildReport = {
			package: "@x/p",
			targetGroups: [
				{
					id: "npm",
					entries: ["index"],
					passes: [],
					warnings: [{ source: "api-extractor", level: "warn", text: "forgotten export Bar" }],
					errors: [],
					suppressed: [],
					timings: { totalMs: 1 },
				},
			],
		};
		const out = MarkdownFormatter.render([warnOnly], ctx);
		expect(out[0].content).toContain("⚠️");
		expect(out[0].content).toContain("forgotten export Bar");
	});

	it("markdown tags ci-fatal warnings, shows callout and suppressed summary", () => {
		const out = MarkdownFormatter.render([fatalReport], ctx);
		expect(out[0].content).toContain("[fails CI]");
		expect(out[0].content).toContain("> ⛔");
		expect(out[0].content).toContain("suppressed 3:");
		expect(out[0].content).toContain("ae-forgotten-export ×2");
	});

	it("markdown --verbose expands suppressed list", () => {
		const out = MarkdownFormatter.render([fatalReport], { noColor: true, verbose: true });
		expect(out[0].content).toContain("Y undocumented");
		expect(out[0].content).not.toContain("suppressed 3:");
	});

	it("ci-annotations emits ::error with file/line", () => {
		const out = CiAnnotationsFormatter.render([report], ctx);
		expect(out[0].content).toContain("::error");
		expect(out[0].content).toContain("a.ts");
	});

	it("json carries code, ciFatal and suppressed", () => {
		const out = JsonFormatter.render([fatalReport], ctx);
		const parsed = JSON.parse(out[0].content);
		expect(parsed[0].targetGroups[0].warnings[0].code).toBe("ae-forgotten-export");
		expect(parsed[0].targetGroups[0].warnings[0].ciFatal).toBe(true);
		expect(parsed[0].targetGroups[0].suppressed).toHaveLength(3);
	});

	it("ci-annotations does not emit suppressed messages or the fails-CI tag", () => {
		const out = CiAnnotationsFormatter.render([fatalReport], ctx);
		const content = out[0]?.content ?? "";
		expect(content).not.toContain("[fails CI]");
		expect(content).not.toContain("Y undocumented"); // suppressed message text must not leak
		expect(content).toContain("::warning"); // the real warning still annotates
	});

	it("silent renders nothing", () => {
		expect(SilentFormatter.render([report], ctx)).toEqual([]);
	});
});

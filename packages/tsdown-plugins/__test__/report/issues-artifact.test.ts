import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { flattenIssues, serializeIssues, writeIssuesArtifact } from "../../src/report/issues-artifact.js";
import { BuildReport, DiagnosticEntry, ReportTimings, TargetGroupReport } from "../../src/report/schema.js";

const warn = (over: Partial<ConstructorParameters<typeof DiagnosticEntry>[0]> = {}) =>
	new DiagnosticEntry({
		source: "api-extractor",
		level: "warn",
		text: "missing release tag",
		code: "ae-missing-release-tag",
		file: "src/index.ts",
		line: 12,
		...over,
	});

const group = (id: string, warnings: DiagnosticEntry[]) =>
	new TargetGroupReport({
		id,
		entries: ["index"],
		passes: [],
		warnings,
		errors: [],
		suppressed: [],
		timings: new ReportTimings({ totalMs: 0 }),
	});

describe("flattenIssues", () => {
	it("aggregates and de-duplicates identical diagnostics across target groups", () => {
		const report = new BuildReport({
			package: "@x/p",
			targetGroups: [group("npm", [warn()]), group("jsr", [warn()])],
		});
		const issues = flattenIssues([report], { target: "prod", generatedAt: "2026-06-21T00:00:00.000Z" });
		expect(issues.package).toBe("@x/p");
		expect(issues.target).toBe("prod");
		expect(issues.generatedAt).toBe("2026-06-21T00:00:00.000Z");
		expect(issues.buildOk).toBe(true);
		expect(issues.failure).toBeUndefined();
		expect(issues.warnings).toHaveLength(1);
		expect(issues.warnings[0]).toEqual({
			source: "api-extractor",
			level: "warn",
			text: "missing release tag",
			code: "ae-missing-release-tag",
			file: "src/index.ts",
			line: 12,
		});
		expect(issues.errors).toEqual([]);
		expect(issues.suppressed).toEqual([]);
	});

	it("keeps distinct diagnostics and drops undefined optional fields", () => {
		const report = new BuildReport({
			package: "@x/p",
			targetGroups: [
				group("npm", [warn(), warn({ line: 20 }), warn({ code: "tsdoc-undefined-tag", text: "bad tag" })]),
			],
		});
		const issues = flattenIssues([report], { target: "prod", generatedAt: "t" });
		expect(issues.warnings).toHaveLength(3);
		const noFileEntry = flattenIssues(
			[
				new BuildReport({
					package: "@x/p",
					targetGroups: [group("npm", [warn({ file: undefined, line: undefined })])],
				}),
			],
			{ target: "dev", generatedAt: "t" },
		).warnings[0];
		expect(Object.keys(noFileEntry ?? {})).toEqual(["source", "level", "text", "code"]);
	});

	it("serializes to pretty JSON with a trailing newline", () => {
		const issues = flattenIssues([new BuildReport({ package: "@x/p", targetGroups: [] })], {
			target: "prod",
			generatedAt: "t",
		});
		const text = serializeIssues(issues);
		expect(text.endsWith("\n")).toBe(true);
		expect(JSON.parse(text)).toEqual({
			generatedAt: "t",
			package: "@x/p",
			target: "prod",
			buildOk: true,
			warnings: [],
			errors: [],
			suppressed: [],
		});
	});

	it("stamps a failed build with buildOk false and the failure", () => {
		const issues = flattenIssues([new BuildReport({ package: "@x/p", targetGroups: [] })], {
			target: "prod",
			generatedAt: "t",
			buildOk: false,
			failure: { name: "InternalError", message: "The referenced path was not found" },
		});
		expect(issues.buildOk).toBe(false);
		expect(issues.failure).toEqual({ name: "InternalError", message: "The referenced path was not found" });
		// The crash-shaped artifact: empty buckets, but no longer indistinguishable from a clean gate.
		expect(issues.errors).toEqual([]);
		expect(issues.warnings).toEqual([]);
	});

	it("omits an empty failure name and truncates an oversized failure message", () => {
		const issues = flattenIssues([new BuildReport({ package: "@x/p", targetGroups: [] })], {
			target: "prod",
			generatedAt: "t",
			buildOk: false,
			failure: { name: "", message: "x".repeat(2500) },
		});
		expect(Object.keys(issues.failure ?? {})).toEqual(["message"]);
		expect(issues.failure?.message).toHaveLength(2001);
		expect(issues.failure?.message.endsWith("…")).toBe(true);
	});
});

describe("writeIssuesArtifact", () => {
	it("writes dist/<target>/issues.json and returns its path", () => {
		const cwd = mkdtempSync(join(tmpdir(), "issues-"));
		const reports = [new BuildReport({ package: "@x/p", targetGroups: [group("npm", [warn()])] })];
		const path = writeIssuesArtifact({
			cwd,
			target: "prod",
			reports,
			now: () => new Date("2026-06-21T00:00:00.000Z"),
		});
		expect(path).toBe(join(cwd, "dist", "prod", "issues.json"));
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		expect(parsed.target).toBe("prod");
		expect(parsed.generatedAt).toBe("2026-06-21T00:00:00.000Z");
		expect(parsed.warnings).toHaveLength(1);
	});

	it("writes an empty-but-present file when there are no issues", () => {
		const cwd = mkdtempSync(join(tmpdir(), "issues-"));
		const path = writeIssuesArtifact({
			cwd,
			target: "dev",
			reports: [new BuildReport({ package: "@x/p", targetGroups: [] })],
			now: () => new Date("2026-06-21T00:00:00.000Z"),
		});
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		expect(parsed).toEqual({
			generatedAt: "2026-06-21T00:00:00.000Z",
			package: "@x/p",
			target: "dev",
			buildOk: true,
			warnings: [],
			errors: [],
			suppressed: [],
		});
	});

	it("stamps buildOk false and the failure when the build crashed", () => {
		const cwd = mkdtempSync(join(tmpdir(), "issues-"));
		const path = writeIssuesArtifact({
			cwd,
			target: "prod",
			reports: [new BuildReport({ package: "@x/p", targetGroups: [] })],
			now: () => new Date("2026-06-21T00:00:00.000Z"),
			buildOk: false,
			failure: { name: "InternalError", message: "dist/prod/npm/pkg/index.d.ts not found" },
		});
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		expect(parsed.buildOk).toBe(false);
		expect(parsed.failure).toEqual({ name: "InternalError", message: "dist/prod/npm/pkg/index.d.ts not found" });
	});

	it("writes atomically — replaces a previous artifact and leaves no temp file behind", () => {
		const cwd = mkdtempSync(join(tmpdir(), "issues-"));
		const write = (buildOk: boolean) =>
			writeIssuesArtifact({
				cwd,
				target: "prod",
				reports: [new BuildReport({ package: "@x/p", targetGroups: [group("npm", buildOk ? [] : [warn()])] })],
				now: () => new Date("2026-06-21T00:00:00.000Z"),
				buildOk,
			});
		write(true);
		const path = write(false);
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		expect(parsed.buildOk).toBe(false);
		expect(parsed.warnings).toHaveLength(1);
		expect(readdirSync(dirname(path))).toEqual(["issues.json"]);
	});
});

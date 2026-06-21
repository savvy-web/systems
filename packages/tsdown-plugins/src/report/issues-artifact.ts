import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BuildReport, DiagnosticEntry } from "./schema.js";

/** A diagnostic flattened to a plain JSON object (only defined fields are present). */
export interface PlainDiagnostic {
	source: DiagnosticEntry["source"];
	level: DiagnosticEntry["level"];
	text: string;
	code?: string;
	ciFatal?: boolean;
	file?: string;
	line?: number;
	column?: number;
}

/** The aggregated build-issues artifact written to `dist/<target>/issues.json`. */
export interface BuildIssues {
	generatedAt: string;
	package: string;
	target: "dev" | "prod";
	warnings: PlainDiagnostic[];
	errors: PlainDiagnostic[];
	suppressed: PlainDiagnostic[];
}

/** Copy a DiagnosticEntry to a plain object, omitting undefined optionals for stable output. */
function toPlain(d: DiagnosticEntry): PlainDiagnostic {
	const out: PlainDiagnostic = { source: d.source, level: d.level, text: d.text };
	if (d.code !== undefined) out.code = d.code;
	if (d.ciFatal !== undefined) out.ciFatal = d.ciFatal;
	if (d.file !== undefined) out.file = d.file;
	if (d.line !== undefined) out.line = d.line;
	if (d.column !== undefined) out.column = d.column;
	return out;
}

/** De-duplicate by the identity-bearing fields (registry target-groups carry identical diagnostics). */
function dedupe(entries: PlainDiagnostic[]): PlainDiagnostic[] {
	const seen = new Set<string>();
	const out: PlainDiagnostic[] = [];
	for (const e of entries) {
		const key = JSON.stringify([e.source, e.level, e.code ?? "", e.text, e.file ?? "", e.line ?? -1, e.column ?? -1]);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(e);
	}
	return out;
}

/** Flatten a build snapshot into the aggregated, de-duplicated issues artifact. Pure. */
export function flattenIssues(
	reports: ReadonlyArray<BuildReport>,
	opts: { target: "dev" | "prod"; generatedAt: string },
): BuildIssues {
	const warnings: PlainDiagnostic[] = [];
	const errors: PlainDiagnostic[] = [];
	const suppressed: PlainDiagnostic[] = [];
	for (const report of reports) {
		for (const g of report.targetGroups) {
			for (const w of g.warnings) warnings.push(toPlain(w));
			for (const e of g.errors) errors.push(toPlain(e));
			for (const s of g.suppressed) suppressed.push(toPlain(s));
		}
	}
	return {
		generatedAt: opts.generatedAt,
		package: reports[0]?.package ?? "unknown",
		target: opts.target,
		warnings: dedupe(warnings),
		errors: dedupe(errors),
		suppressed: dedupe(suppressed),
	};
}

/** Serialize the issues artifact to pretty JSON with a trailing newline. */
export function serializeIssues(issues: BuildIssues): string {
	return `${JSON.stringify(issues, null, 2)}\n`;
}

/** Write the aggregated issues artifact to `<cwd>/dist/<target>/issues.json`. Returns the path written. */
export function writeIssuesArtifact(opts: {
	cwd: string;
	target: "dev" | "prod";
	reports: ReadonlyArray<BuildReport>;
	now?: () => Date;
}): string {
	const clock = opts.now ?? (() => new Date());
	const issues = flattenIssues(opts.reports, { target: opts.target, generatedAt: clock().toISOString() });
	const outPath = join(opts.cwd, "dist", opts.target, "issues.json");
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, serializeIssues(issues), "utf8");
	return outPath;
}

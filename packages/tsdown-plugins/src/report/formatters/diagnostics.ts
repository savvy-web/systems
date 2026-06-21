// packages/tsdown-plugins/src/report/formatters/diagnostics.ts
import type { BuildReport, DiagnosticEntry } from "../schema.js";

/** "code ×N, code2 ×M", sorted by count desc then code asc. */
export function suppressedSummary(entries: ReadonlyArray<DiagnosticEntry>): string {
	const counts = new Map<string, number>();
	for (const e of entries) {
		const code = e.code ?? "unknown";
		counts.set(code, (counts.get(code) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([code, n]) => `${code} ×${n}`)
		.join(", ");
}

/** Number of warnings flagged ci-fatal across every group of a package. */
export function ciFatalCountForPackage(report: BuildReport): number {
	let n = 0;
	for (const g of report.targetGroups) for (const w of g.warnings) if (w.ciFatal === true) n += 1;
	return n;
}

/** The persuasive callout shown when ci-fatal warnings are present locally. */
export function ciFatalCallout(n: number): string {
	const verb = n === 1 ? "becomes" : "become";
	const noun = n === 1 ? "issue" : "issues";
	return `⛔ ${n} ${noun} here ${verb} a hard error in CI and will fail the build. Fix before pushing.`;
}

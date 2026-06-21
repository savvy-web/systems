// packages/tsdown-plugins/src/report/formatters/markdown.ts
import { ciFatalCallout, ciFatalCountForPackage, suppressedSummary } from "./diagnostics.js";
import type { Formatter } from "./types.js";

export const MarkdownFormatter: Formatter = {
	format: "markdown",
	render: (reports, ctx) => {
		const lines: string[] = [];
		for (const r of reports) {
			const hasErrors = r.targetGroups.some((g) => g.errors.length > 0);
			const hasWarnings = r.targetGroups.some((g) => g.warnings.length > 0);
			const hasSuppressed = r.targetGroups.some((g) => g.suppressed.length > 0);
			// ❌ on any error, ⚠️ on warnings/suppressed, ✅ when clean. Warnings must surface here: this is
			// the formatter agent and grouped-log contexts receive, so dropping them hides api-extractor signal.
			const icon = hasErrors ? "❌" : hasWarnings || hasSuppressed ? "⚠️" : "✅";
			lines.push(`## ${icon} ${r.package}`);
			for (const g of r.targetGroups) {
				if (g.errors.length === 0 && g.warnings.length === 0 && g.suppressed.length === 0) continue;
				lines.push(`- **${g.id}**`);
				for (const e of g.errors) lines.push(`  - ❌ ${e.text}`);
				for (const w of g.warnings) lines.push(`  - ⚠️ ${w.text}${w.ciFatal === true ? " [fails CI]" : ""}`);
				if (g.suppressed.length > 0) {
					if (ctx.verbose) {
						for (const s of g.suppressed) lines.push(`  - 🔇 ${s.code ?? "?"}: ${s.text}`);
					} else {
						lines.push(`  - 🔇 suppressed ${g.suppressed.length}: ${suppressedSummary(g.suppressed)}`);
					}
				}
			}
			const fatal = ciFatalCountForPackage(r);
			if (fatal > 0) lines.push(`> ${ciFatalCallout(fatal)}`);
		}
		return [{ target: "stdout", content: lines.join("\n"), contentType: "text/markdown" }];
	},
};

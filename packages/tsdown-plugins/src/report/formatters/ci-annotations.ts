// packages/tsdown-plugins/src/report/formatters/ci-annotations.ts
import type { Formatter } from "./types.js";

const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

export const CiAnnotationsFormatter: Formatter = {
	format: "ci-annotations",
	render: (reports) => {
		const lines: string[] = [];
		for (const r of reports) {
			for (const g of r.targetGroups) {
				for (const e of g.errors) lines.push(`::error title=${esc(r.package)} (${esc(g.id)})::${esc(e)}`);
				for (const w of g.warnings) lines.push(`::warning title=${esc(r.package)} (${esc(g.id)})::${esc(w)}`);
			}
		}
		return lines.length === 0 ? [] : [{ target: "stdout", content: lines.join("\n"), contentType: "text/plain" }];
	},
};

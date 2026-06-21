// packages/tsdown-plugins/src/report/formatters/ci-annotations.ts
import type { Formatter } from "./types.js";

const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

export const CiAnnotationsFormatter: Formatter = {
	format: "ci-annotations",
	render: (reports) => {
		const lines: string[] = [];
		for (const r of reports) {
			for (const g of r.targetGroups) {
				for (const e of g.errors) {
					const loc =
						e.file !== undefined ? ` file=${esc(e.file)}${e.line !== undefined ? `,line=${e.line}` : ""}` : "";
					lines.push(`::error title=${esc(r.package)} (${esc(g.id)})${loc}::${esc(e.text)}`);
				}
				for (const w of g.warnings) {
					const loc =
						w.file !== undefined ? ` file=${esc(w.file)}${w.line !== undefined ? `,line=${w.line}` : ""}` : "";
					lines.push(`::warning title=${esc(r.package)} (${esc(g.id)})${loc}::${esc(w.text)}`);
				}
			}
		}
		return lines.length === 0 ? [] : [{ target: "stdout", content: lines.join("\n"), contentType: "text/plain" }];
	},
};

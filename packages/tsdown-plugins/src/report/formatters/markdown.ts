// packages/tsdown-plugins/src/report/formatters/markdown.ts
import type { Formatter } from "./types.js";

export const MarkdownFormatter: Formatter = {
	format: "markdown",
	render: (reports) => {
		const lines: string[] = [];
		for (const r of reports) {
			const failing = r.targetGroups.filter((g) => g.errors.length > 0);
			if (failing.length > 0) {
				lines.push(`## ❌ ${r.package}`);
				for (const g of failing) {
					lines.push(`- **${g.id}**`);
					for (const e of g.errors) lines.push(`  - ${e.text}`);
				}
			} else {
				lines.push(`## ✅ ${r.package}`);
			}
		}
		return [{ target: "stdout", content: lines.join("\n"), contentType: "text/markdown" }];
	},
};

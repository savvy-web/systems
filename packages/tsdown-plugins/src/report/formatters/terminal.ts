// packages/tsdown-plugins/src/report/formatters/terminal.ts
import pc from "picocolors";
import { formatTime } from "../timer.js";
import type { Formatter } from "./types.js";

export const TerminalFormatter: Formatter = {
	format: "terminal",
	render: (reports, ctx) => {
		const color = (fn: (s: string) => string, s: string) => (ctx.noColor ? s : fn(s));
		const lines: string[] = [];
		for (const r of reports) {
			lines.push(color(pc.bold, r.package));
			for (const g of r.targetGroups) {
				const status = g.errors.length ? color(pc.red, "✗") : color(pc.green, "✓");
				lines.push(`  ${status} ${g.id} — ${g.emittedFiles.length} files (${formatTime(g.timings.totalMs)})`);
				for (const e of g.errors) lines.push(`    ${color(pc.red, "error")}: ${e}`);
				for (const w of g.warnings) lines.push(`    ${color(pc.yellow, "warn")}: ${w}`);
			}
		}
		const content = lines.join("\n");
		return content === "" ? [] : [{ target: "stdout", content, contentType: "text/plain" }];
	},
};

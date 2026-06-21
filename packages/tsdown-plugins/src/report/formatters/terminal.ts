// packages/tsdown-plugins/src/report/formatters/terminal.ts
import pc from "picocolors";
import type { DiagnosticEntry, TargetGroupReport } from "../schema.js";
import { formatTime } from "../timer.js";
import type { Formatter } from "./types.js";

const fmtBytes = (n: number): string => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} kB`);

const fileCount = (g: TargetGroupReport): number => g.passes.reduce((sum, p) => sum + p.files.length, 0);

const diagLine = (d: DiagnosticEntry): string => {
	const loc = d.file !== undefined ? ` ${d.file}${d.line !== undefined ? `:${d.line}` : ""}` : "";
	return `${loc} ${d.text}`.trim();
};

export const TerminalFormatter: Formatter = {
	format: "terminal",
	render: (reports, ctx) => {
		const color = (fn: (s: string) => string, s: string) => (ctx.noColor ? s : fn(s));
		const lines: string[] = [];
		let totalMs = 0;
		for (const r of reports) {
			lines.push(color(pc.bold, r.package));
			for (const g of r.targetGroups) {
				const status = g.errors.length ? color(pc.red, "✗") : color(pc.green, "✓");
				lines.push(`  ${status} ${g.id}  ${fileCount(g)} files · ${formatTime(g.timings.totalMs)}`);
				totalMs += g.timings.totalMs;
				if (ctx.verbose) {
					for (const p of g.passes) {
						lines.push(`    ${color(pc.dim, `${p.id} (${formatTime(p.ms)})`)}`);
						for (const f of p.files) {
							const gz = f.gzip !== undefined ? ` │ gzip ${fmtBytes(f.gzip)}` : "";
							lines.push(`      ${f.path}  ${fmtBytes(f.bytes)}${gz}`);
						}
					}
				}
				for (const e of g.errors) lines.push(`    ${color(pc.red, "error")} ${diagLine(e)}`);
				for (const w of g.warnings) lines.push(`    ${color(pc.yellow, "warn")} ${diagLine(w)}`);
			}
		}
		const pkgs = reports.length;
		if (pkgs > 0) {
			lines.push(
				`${color(pc.green, "✔")} build complete · ${pkgs} package${pkgs === 1 ? "" : "s"} · ${formatTime(totalMs)}`,
			);
		}
		const content = lines.join("\n");
		return content === "" ? [] : [{ target: "stdout", content, contentType: "text/plain" }];
	},
};

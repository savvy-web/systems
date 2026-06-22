import { gzipSync } from "node:zlib";
import type { Plugin } from "rolldown";
import type { BuildCollector, PassKind } from "./collector.js";

function contentOf(chunk: unknown): string | Uint8Array | undefined {
	const c = chunk as { type?: string; code?: string; source?: string | Uint8Array };
	if (c.type === "chunk") return c.code;
	if (c.type === "asset") return c.source;
	return c.code ?? c.source;
}

function byteLength(content: string | Uint8Array): number {
	return typeof content === "string" ? Buffer.byteLength(content) : content.byteLength;
}

/**
 * Rolldown plugin that records emitted-file metrics into the BuildCollector via writeBundle (which
 * fires for the JS pass AND the emitDtsOnly dts pass — verified against tsdown 0.22.3), plus a
 * defensive onLog for rolldown-level diagnostics that bypass tsdown's logger. Append it to each
 * build pass's `plugins` array. `bytes` is taken from the in-memory chunk/asset content (no fs);
 * `gzip` is computed only when `verbose`.
 * @public
 */
export function buildMetricsPlugin(
	collector: BuildCollector,
	groupId: string,
	pass: PassKind,
	verbose: boolean,
): Plugin {
	return {
		name: "savvy:build-metrics",
		writeBundle(_outputOptions, bundle: Record<string, unknown>): void {
			for (const [key, chunk] of Object.entries(bundle)) {
				const content = contentOf(chunk);
				if (content === undefined) continue;
				const bytes = byteLength(content);
				collector.recordEmitted(groupId, pass, {
					path: key,
					bytes,
					...(verbose ? { gzip: gzipSync(typeof content === "string" ? Buffer.from(content) : content).length } : {}),
				});
			}
		},
		onLog(level: string, log: unknown): boolean | undefined {
			const l = log as { message?: string; id?: string; loc?: { line?: number; column?: number } };
			const text = l.message ?? String(log);
			const entry = {
				text,
				...(l.id !== undefined ? { file: l.id } : {}),
				...(l.loc?.line !== undefined ? { line: l.loc.line } : {}),
				...(l.loc?.column !== undefined ? { column: l.loc.column } : {}),
			};
			if (level === "error") {
				// Record the error but do NOT suppress: returning undefined lets rolldown's default error
				// reporting fire, so a build error is never silently swallowed.
				collector.recordError(groupId, { source: "rolldown", level: "error", ...entry });
				return undefined;
			}
			// Non-error (warn and anything else): record warn-level diagnostics, then suppress the console leak.
			if (level === "warn") collector.recordWarning(groupId, { source: "rolldown", level: "warn", ...entry });
			return false;
		},
	};
}

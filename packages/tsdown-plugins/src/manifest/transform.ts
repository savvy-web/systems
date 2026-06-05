// packages/tsdown-plugins/src/manifest/transform.ts
import sortPackageJson from "sort-package-json";

export type Json = Record<string, unknown>;

const stripLeadingDotSlash = (p: string): string => (p.startsWith("./") ? p.slice(2) : p);

/** TS source path to built .js (and .d.ts for types). Mirrors rslib transformExportPath. */
const toBuiltJs = (p: string): string =>
	"./" +
	stripLeadingDotSlash(p)
		.replace(/^src\//, "")
		.replace(/\.tsx?$/, ".js");
const toBuiltDts = (p: string): string => toBuiltJs(p).replace(/\.js$/, ".d.ts");

const isTs = (p: string): boolean => p.endsWith(".ts") || p.endsWith(".tsx");

/** Rewrite an exports map: TS string targets become a types/import conditions object. */
export function transformExports(exports: unknown): unknown {
	if (typeof exports === "string") {
		return isTs(exports) ? { types: toBuiltDts(exports), import: toBuiltJs(exports) } : exports;
	}
	if (exports && typeof exports === "object") {
		const out: Json = {};
		for (const [key, value] of Object.entries(exports as Json)) {
			if (key === "./package.json" || key.endsWith(".json")) {
				out[key] = value;
				continue;
			}
			if (typeof value === "string" && isTs(value)) {
				out[key] = { types: toBuiltDts(value), import: toBuiltJs(value) };
			} else {
				out[key] = value;
			}
		}
		return out;
	}
	return exports;
}

/** Rewrite bin: TS targets to bin/[command].js (string to bin/cli.js); strip leading ./ otherwise. */
export function transformBin(bin: unknown): unknown {
	if (typeof bin === "string") return isTs(bin) ? "bin/cli.js" : stripLeadingDotSlash(bin);
	if (bin && typeof bin === "object") {
		const out: Record<string, string> = {};
		for (const [command, p] of Object.entries(bin as Record<string, string>)) {
			out[command] = isTs(p) ? `bin/${command}.js` : stripLeadingDotSlash(p);
		}
		return out;
	}
	return bin;
}

/** FINAL guard: strip leading ./ from bin paths (npm 11.x drops ./-prefixed bins). */
export function normalizeBinPaths(bin: unknown): unknown {
	if (typeof bin === "string") return stripLeadingDotSlash(bin);
	if (bin && typeof bin === "object") {
		const out: Record<string, string> = {};
		for (const [command, p] of Object.entries(bin as Record<string, string>)) out[command] = stripLeadingDotSlash(p);
		return out;
	}
	return bin;
}

export interface TransformManifestOptions {
	/** Run after the standard transforms, before the bin final-guard + sort. */
	readonly transform?: ((pkg: Json) => Json) | undefined;
}

/** Apply the full standard manifest transform (excluding catalog resolution, done upstream). */
export function transformManifest(pkg: Json, options: TransformManifestOptions = {}): Json {
	const { publishConfig, scripts, ...rest } = pkg as Json & {
		publishConfig?: { access?: string };
		scripts?: unknown;
	};
	const isPrivate = !(publishConfig?.access === "public");
	let result: Json = { ...rest, private: isPrivate };
	if (result.exports) result.exports = transformExports(result.exports);
	if (result.bin) result.bin = transformBin(result.bin);
	if (options.transform) result = options.transform(result);
	if (result.bin) result.bin = normalizeBinPaths(result.bin);
	return sortPackageJson(result as never) as unknown as Json;
}

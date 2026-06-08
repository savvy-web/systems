// packages/tsdown-plugins/src/manifest/transform.ts
import sortPackageJson from "sort-package-json";
import { createEntryName } from "../entry/extract.js";

export type Json = Record<string, unknown>;

const stripLeadingDotSlash = (p: string): string => (p.startsWith("./") ? p.slice(2) : p);

/**
 * Built .js output basename for an export, derived from the entry NAME (the basename
 * the build actually emits) rather than the source path. The entry namer flattens
 * nested subpaths to a dash-joined basename (e.g. `./commitlint` to `commitlint.js`,
 * `./changesets/markdownlint` to `changesets-markdownlint.js`), so the declared path
 * always matches the file tsdown emits. The build never sets exportsAsIndexes, so the
 * manifest mirrors the flat (false) naming here.
 */
const toBuiltJs = (exportKey: string): string => `./${createEntryName(exportKey, false)}.js`;
const toBuiltDts = (exportKey: string): string => toBuiltJs(exportKey).replace(/\.js$/, ".d.ts");
const toBuiltCjs = (exportKey: string): string => toBuiltJs(exportKey).replace(/\.js$/, ".cjs");

const isTs = (p: string): boolean => p.endsWith(".ts") || p.endsWith(".tsx");

/** Build the conditions object for a TS export target (adds require when dual-format). */
const tsConditions = (exportKey: string, dual: boolean): Json => ({
	types: toBuiltDts(exportKey),
	import: toBuiltJs(exportKey),
	...(dual ? { require: toBuiltCjs(exportKey) } : {}),
});

/**
 * Rewrite an exports map: TS string targets become a types/import conditions object.
 * When dual is true (a cjs build), each TS condition also gets a require entry.
 *
 * The output path is derived from the export KEY via the shared entry-name function,
 * never from the source path, so the manifest target always matches the emitted file.
 */
export function transformExports(exports: unknown, dual = false): unknown {
	// A bare string export is the root (`.`) target.
	if (typeof exports === "string") {
		return isTs(exports) ? tsConditions(".", dual) : exports;
	}
	if (exports && typeof exports === "object") {
		const out: Json = {};
		for (const [key, value] of Object.entries(exports as Json)) {
			if (key === "./package.json" || key.endsWith(".json")) {
				out[key] = value;
				continue;
			}
			if (typeof value === "string" && isTs(value)) {
				out[key] = tsConditions(key, dual);
			} else {
				out[key] = transformExports(value, dual);
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
	/** Emit dual import/require export conditions (set when the build includes cjs). */
	readonly dual?: boolean | undefined;
}

/** Apply the full standard manifest transform (excluding catalog resolution, done upstream). */
export function transformManifest(pkg: Json, options: TransformManifestOptions = {}): Json {
	const { publishConfig, scripts, ...rest } = pkg as Json & {
		publishConfig?: { access?: string };
		scripts?: unknown;
	};
	const isPrivate = !(publishConfig?.access === "public");
	let result: Json = { ...rest, private: isPrivate };
	if (result.exports) result.exports = transformExports(result.exports, options.dual ?? false);
	if (result.bin) result.bin = transformBin(result.bin);
	if (options.transform) result = options.transform(result);
	if (result.bin) result.bin = normalizeBinPaths(result.bin);
	return sortPackageJson(result as never) as unknown as Json;
}

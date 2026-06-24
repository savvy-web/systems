import { join } from "node:path";
import { declarationsDirFor } from "../build/target-groups.js";
import { resolveNextVersions as realResolveNextVersions } from "../changesets/next-versions.js";
import { createEntryName } from "../entry/extract.js";
import type { BuildCollector } from "../report/collector.js";
import type { MetaOptions } from "./config.js";
import { normalizeMetaOptions } from "./config.js";
import type { GenerateMetaOptions, MetaResult } from "./generate.js";
import { generateMeta as realGenerateMeta } from "./generate.js";
import { rewriteMetaVersions } from "./optimistic.js";

/**
 * Options for the meta-pass orchestrator.
 *
 * @public
 */
export interface RunMetaPassOptions {
	readonly cwd: string;
	readonly packageName: string;
	readonly tsconfigPath: string;
	readonly groups: ReadonlyArray<{ id: string; name: string }>;
	readonly entries: Record<string, string>;
	readonly exportsMap: Record<string, string> | undefined;
	readonly overrides?: ReadonlyArray<{ entries: ReadonlyArray<string>; outSubdir?: string | undefined }> | undefined;
	readonly meta: MetaOptions;
	readonly collector: BuildCollector;
	readonly ci: boolean;
	/** Injectable for tests; defaults to the real generateMeta. */
	readonly generateMeta?: (o: GenerateMetaOptions) => Promise<MetaResult>;
	/** Injectable for tests; defaults to the real resolveNextVersions. Only called when optimistic. */
	readonly resolveNextVersions?: (cwd: string) => Promise<{ versions: ReadonlyMap<string, string> }>;
}

/**
 * Meta-pass orchestrator: derives export paths, filters bin/ entries, resolves optimistic
 * next-versions, and calls generateMeta once per publish group.
 * @public
 */
export async function runMetaPass(o: RunMetaPassOptions): Promise<void> {
	const gen = o.generateMeta ?? realGenerateMeta;
	const norm = normalizeMetaOptions(o.meta);
	const canonical = o.groups.find((g) => g.name === o.packageName) ?? o.groups[0];
	const canonicalId = canonical?.id ?? "npm";
	const dtsBasenames: Record<string, string> = {};
	const nonBinEntries: Record<string, string> = {};
	for (const [name, src] of Object.entries(o.entries)) {
		if (!name.startsWith("bin/")) {
			dtsBasenames[name] = name;
			nonBinEntries[name] = src;
		}
	}
	const exportPaths = deriveExportPaths(nonBinEntries, o.exportsMap);
	applySubdirMetaEntries(o.overrides, dtsBasenames, exportPaths);

	const resolveNext = o.resolveNextVersions ?? realResolveNextVersions;
	const nextVersions = norm.optimistic ? await resolveNext(o.cwd) : undefined;
	const manifestTransform = nextVersions
		? (m: Record<string, unknown>) => rewriteMetaVersions(m, nextVersions.versions, o.packageName)
		: undefined;

	for (const g of o.groups) {
		await gen({
			cwd: o.cwd,
			packageName: o.packageName,
			tsconfigPath: o.tsconfigPath,
			dtsDir: join(o.cwd, "dist", "prod", g.id, "pkg"),
			aeInputDir: declarationsDirFor(o.cwd, g.id),
			entries: dtsBasenames,
			exportPaths,
			outMetaDir: join(o.cwd, "dist", "prod", g.id, "meta"),
			localPaths: g.id === canonicalId ? norm.localPaths : [],
			tsdoc: norm.tsdoc,
			...(manifestTransform !== undefined ? { manifestTransform } : {}),
			ci: o.ci,
			onMessage: (e) => (e.level === "error" ? o.collector.recordError(g.id, e) : o.collector.recordWarning(g.id, e)),
			onSuppressed: (e) => o.collector.recordSuppressed(g.id, e),
		} satisfies GenerateMetaOptions);
	}
}

/**
 * Map entry names to export paths using the package exports map. index maps to ".".
 *
 * @public
 */
export function deriveExportPaths(
	entries: Record<string, string>,
	exportsMap: Record<string, string> | undefined,
): Record<string, string> {
	const out: Record<string, string> = {};
	const sourceToKey = new Map<string, string>();
	if (exportsMap) for (const [key, src] of Object.entries(exportsMap)) sourceToKey.set(src, key);
	for (const [entryName, src] of Object.entries(entries)) {
		out[entryName] = sourceToKey.get(src) ?? (entryName === "index" ? "." : `./${entryName}`);
	}
	return out;
}

/**
 * For each `outSubdir` override, point its meta entry at the isolated sub-package barrel.
 *
 * @public
 */
export function applySubdirMetaEntries(
	overrides: ReadonlyArray<{ entries: ReadonlyArray<string>; outSubdir?: string | undefined }> | undefined,
	dtsBasenames: Record<string, string>,
	exportPaths: Record<string, string>,
): void {
	if (overrides === undefined) return;
	for (const ov of overrides) {
		if (ov.outSubdir === undefined) continue;
		const exportPath = ov.entries[0];
		if (exportPath === undefined) continue;
		const flatName = createEntryName(exportPath, false);
		dtsBasenames[flatName] = `${ov.outSubdir}/index`;
		exportPaths[flatName] = exportPath;
	}
}

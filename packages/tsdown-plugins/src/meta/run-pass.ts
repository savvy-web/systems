import { createEntryName } from "../entry/extract.js";

/** Map entry names to export paths using the package exports map. index maps to ".". */
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

/** For each `outSubdir` override, point its meta entry at the isolated sub-package barrel. */
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

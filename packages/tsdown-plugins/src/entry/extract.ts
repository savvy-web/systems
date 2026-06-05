// packages/tsdown-plugins/src/entry/extract.ts

export interface PackageJsonLike {
	readonly exports?: unknown;
	readonly bin?: unknown;
}

export interface ExtractOptions {
	readonly exportsAsIndexes?: boolean | undefined;
}

export interface ExtractResult {
	/** entry name to TS source path */
	readonly entries: Record<string, string>;
	/** entry name to original export key (for downstream output-map alignment) */
	readonly exportPaths: Record<string, string>;
}

const isTypeScriptFile = (p: string): boolean => p.endsWith(".ts") || p.endsWith(".tsx");

/** /dist/*.js to /src/*.ts; otherwise unchanged. */
const resolveToTypeScript = (p: string): string =>
	p.endsWith(".js") && p.includes("/dist/") ? p.replace("/dist/", "/src/").replace(/\.js$/, ".ts") : p;

/** Resolve an export value to a source path: import || default || types (NOT require). */
const resolveSourcePath = (value: unknown): string | undefined => {
	if (typeof value === "string") return value;
	if (value && typeof value === "object") {
		const o = value as Record<string, unknown>;
		return (o.import as string) || (o.default as string) || (o.types as string) || undefined;
	}
	return undefined;
};

const createEntryName = (exportKey: string, exportsAsIndexes: boolean): string => {
	if (exportKey === ".") return "index";
	const withoutPrefix = exportKey.replace(/^\.\//, "");
	return exportsAsIndexes ? `${withoutPrefix}/index` : withoutPrefix.replace(/\//g, "-");
};

export function extractEntries(pkg: PackageJsonLike, options: ExtractOptions = {}): ExtractResult {
	const entries: Record<string, string> = {};
	const exportPaths: Record<string, string> = {};
	const exportsAsIndexes = options.exportsAsIndexes ?? false;

	// --- exports ---
	const exports = pkg.exports;
	if (typeof exports === "string") {
		if (isTypeScriptFile(exports)) {
			entries.index = exports;
			exportPaths.index = ".";
		}
	} else if (exports && typeof exports === "object") {
		for (const [key, value] of Object.entries(exports as Record<string, unknown>)) {
			if (key === "./package.json" || key.endsWith(".json")) continue;
			const sourcePath = resolveSourcePath(value);
			if (!sourcePath) continue;
			const resolved = resolveToTypeScript(sourcePath);
			if (!isTypeScriptFile(resolved)) continue;
			const name = createEntryName(key, exportsAsIndexes);
			entries[name] = resolved;
			exportPaths[name] = key;
		}
	}

	// --- bin ---
	const bin = pkg.bin;
	if (typeof bin === "string") {
		const resolved = resolveToTypeScript(bin);
		if (isTypeScriptFile(resolved)) entries["bin/cli"] = resolved;
	} else if (bin && typeof bin === "object") {
		for (const [command, p] of Object.entries(bin as Record<string, unknown>)) {
			if (typeof p !== "string") continue;
			const resolved = resolveToTypeScript(p);
			if (isTypeScriptFile(resolved)) entries[`bin/${command}`] = resolved;
		}
	}

	return { entries, exportPaths };
}

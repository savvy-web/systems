import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runApiExtractor } from "./api-extractor.js";
import type { NormalizedMeta } from "./config.js";
import { mergeApiModels } from "./merge-models.js";
import { resolvePortableTsconfig } from "./tsconfig-resolver.js";
import { writeTsdocConfig } from "./tsdoc-config.js";

function unscopedName(name: string): string {
	const slash = name.lastIndexOf("/");
	return slash >= 0 ? name.slice(slash + 1) : name;
}

export interface GenerateMetaOptions {
	readonly cwd: string;
	readonly packageName: string;
	/** Resolved tsconfig (from writeResolvedTsconfig) for the api-extractor compiler. */
	readonly tsconfigPath: string;
	/** Directory holding the tsdown-emitted per-file .d.ts (e.g. dist/dev/pkg). */
	readonly dtsDir: string;
	/** Map of entry name to the .d.ts basename (without extension) inside dtsDir. */
	readonly entries: Record<string, string>;
	/** Map of entry name to its export path (".", "./sub"). */
	readonly exportPaths: Record<string, string>;
	/** Where to write the meta bundle (.api.json + package.json + tsconfig.json). */
	readonly outMetaDir: string;
	/** Directories (relative to cwd) to copy the meta bundle into. */
	readonly localPaths: ReadonlyArray<string>;
	readonly tsdoc: NormalizedMeta["tsdoc"];
	/**
	 * Optional transform applied to the bundle `package.json` (read from `dtsDir`) before it is
	 * written to `outMetaDir` and copied into `localPaths`. Used for the optimistic next-version
	 * rewrite. When omitted, the package.json is copied verbatim.
	 */
	readonly manifestTransform?: ((pkg: Record<string, unknown>) => Record<string, unknown>) | undefined;
	/** When set, API Extractor warnings/errors are routed here (and suppressed from console). */
	readonly onMessage?: ((entry: import("../report/collector.js").DiagnosticInput) => void) | undefined;
	/** When true (CI), forgotten exports become a hard build error. */
	readonly ci?: boolean | undefined;
	/** When set, messages matched by `suppressWarnings` are routed here for accounting. */
	readonly onSuppressed?: ((entry: import("../report/collector.js").DiagnosticInput) => void) | undefined;
}

export interface MetaResult {
	readonly apiJsonPath: string;
	readonly apiJsonFilename: string;
}

/**
 * Generate the api-model meta bundle from already-emitted .d.ts. Writes tsdoc.json (idempotent),
 * runs the extractor per entry, merges if needed, and writes the "virtual TS env" trio to
 * outMetaDir (`<unscoped>.api.json` + the final `package.json` + a portable `tsconfig.json`),
 * copying that trio into each localPaths dir. The api-extractor `tsdoc-metadata.json` is a
 * published-package artifact and is written into `dtsDir` (the built pkg/), not the meta bundle.
 */
export async function generateMeta(options: GenerateMetaOptions): Promise<MetaResult> {
	const {
		cwd,
		packageName,
		tsconfigPath,
		dtsDir,
		entries,
		exportPaths,
		outMetaDir,
		localPaths,
		tsdoc,
		manifestTransform,
		onMessage,
		ci,
		onSuppressed,
	} = options;
	const tsdocConfigPath = writeTsdocConfig(cwd, tsdoc);
	const packageJsonPath = join(cwd, "package.json");

	mkdirSync(outMetaDir, { recursive: true });
	const apiJsonFilename = `${unscopedName(packageName)}.api.json`;
	// tsdoc-metadata.json is a published-package artifact (TSDoc tooling reads it from the package
	// root), so emit it into the built pkg dir rather than the shiki/Twoslash meta bundle.
	const tsdocMetadataPath = join(dtsDir, "tsdoc-metadata.json");

	const entryNames = Object.keys(entries);
	const perEntryModels = new Map<string, Record<string, unknown>>();
	// Intermediate per-entry models are working files; they must not leak into the meta bundle (outMetaDir ships for the npm target).
	const intermediateApiJsons: string[] = [];
	let mainEntryDidTsdocMetadata = false;
	for (const entryName of entryNames) {
		const entryDtsPath = join(dtsDir, `${entries[entryName]}.d.ts`);
		// Entry names can contain path separators (e.g. "foo/index", "bin/cli"); flatten so the
		// intermediate working file stays directly under outMetaDir rather than a missing subdir.
		const safeEntry = entryName.replace(/[\\/]/g, "__");
		const perEntryApiJson = join(outMetaDir, `${safeEntry}.entry.api.json`);
		intermediateApiJsons.push(perEntryApiJson);
		const isMain = (exportPaths[entryName] ?? (entryName === "index" ? "." : `./${entryName}`)) === ".";
		runApiExtractor({
			cwd,
			packageJsonPath,
			entryDtsPath,
			tsconfigPath,
			tsdocConfigPath,
			apiJsonPath: perEntryApiJson,
			// Only the main entry emits tsdoc-metadata.json.
			...(isMain && !mainEntryDidTsdocMetadata ? { tsdocMetadataPath } : {}),
			suppressWarnings: tsdoc.suppressWarnings,
			...(ci !== undefined ? { ci } : {}),
			...(onMessage !== undefined ? { onMessage } : {}),
			...(onSuppressed !== undefined ? { onSuppressed } : {}),
		});
		if (isMain) mainEntryDidTsdocMetadata = true;
		perEntryModels.set(entryName, JSON.parse(readFileSync(perEntryApiJson, "utf-8")) as Record<string, unknown>);
	}

	// Merge or take the single model.
	const finalModel =
		perEntryModels.size === 1
			? (perEntryModels.values().next().value as Record<string, unknown>)
			: mergeApiModels({ perEntryModels, packageName, exportPaths });

	const apiJsonPath = join(outMetaDir, apiJsonFilename);
	writeFileSync(apiJsonPath, `${JSON.stringify(finalModel, null, 2)}\n`, "utf-8");

	// Remove the per-entry working files now that the final merged model is written.
	for (const intermediate of intermediateApiJsons) rmSync(intermediate, { force: true });

	// The meta bundle is a self-contained virtual TS env for shiki/Twoslash. It carries a portable,
	// derived tsconfig (compilerOptions-only, no absolute paths or emit settings). The portable config
	// is derived from the package's own tsconfig; `tsconfigPath` (the build's resolved api-extractor
	// compile config) is the fallback when there is no own tsconfig.
	// The meta bundle carries the FINAL transformed package.json (from the built pkg dir, not the
	// source manifest). When a manifestTransform is supplied (optimistic next-version rewrite), apply
	// it here so both the bundle and the localPaths copies below see the rewritten manifest.
	const bundlePackageJson = join(outMetaDir, "package.json");
	const builtPkg = JSON.parse(readFileSync(join(dtsDir, "package.json"), "utf-8")) as Record<string, unknown>;
	const finalPkg = manifestTransform ? manifestTransform(builtPkg) : builtPkg;
	writeFileSync(bundlePackageJson, `${JSON.stringify(finalPkg, null, 2)}\n`, "utf-8");

	const bundleTsconfig = join(outMetaDir, "tsconfig.json");
	const portableTsconfig = resolvePortableTsconfig(cwd, tsconfigPath);
	writeFileSync(bundleTsconfig, `${JSON.stringify(portableTsconfig, null, 2)}\n`, "utf-8");

	// Copy the trio into each localPaths dir (api.json + package.json + tsconfig.json).
	for (const localPath of localPaths) {
		const dest = join(cwd, localPath);
		mkdirSync(dest, { recursive: true });
		copyFileSync(apiJsonPath, join(dest, apiJsonFilename));
		copyFileSync(bundlePackageJson, join(dest, "package.json"));
		copyFileSync(bundleTsconfig, join(dest, "tsconfig.json"));
	}

	return { apiJsonPath, apiJsonFilename };
}

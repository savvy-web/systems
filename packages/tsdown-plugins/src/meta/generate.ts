import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runApiExtractor } from "./api-extractor.js";
import type { NormalizedMeta } from "./config.js";
import { mergeApiModels } from "./merge-models.js";
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
	/** Where to write the meta bundle (.api.json + tsdoc-metadata.json + tsconfig.json). */
	readonly outMetaDir: string;
	/** Directories (relative to cwd) to copy the meta bundle into. */
	readonly localPaths: ReadonlyArray<string>;
	readonly tsdoc: NormalizedMeta["tsdoc"];
}

export interface MetaResult {
	readonly apiJsonPath: string;
	readonly apiJsonFilename: string;
}

/** Generate the api-model meta bundle from already-emitted .d.ts. Writes tsdoc.json (idempotent), runs the extractor per entry, merges if needed, writes the bundle to outMetaDir, and copies it into each localPaths dir. */
export async function generateMeta(options: GenerateMetaOptions): Promise<MetaResult> {
	const { cwd, packageName, tsconfigPath, dtsDir, entries, exportPaths, outMetaDir, localPaths, tsdoc } = options;
	const tsdocConfigPath = writeTsdocConfig(cwd, tsdoc);
	const packageJsonPath = join(cwd, "package.json");

	mkdirSync(outMetaDir, { recursive: true });
	const apiJsonFilename = `${unscopedName(packageName)}.api.json`;
	const tsdocMetadataPath = join(outMetaDir, "tsdoc-metadata.json");

	const entryNames = Object.keys(entries);
	const perEntryModels = new Map<string, Record<string, unknown>>();
	// Intermediate per-entry models are working files; they must not leak into the meta bundle (outMetaDir ships for the npm target).
	const intermediateApiJsons: string[] = [];
	let mainEntryDidTsdocMetadata = false;
	for (const entryName of entryNames) {
		const entryDtsPath = join(dtsDir, `${entries[entryName]}.d.ts`);
		const perEntryApiJson = join(outMetaDir, `${entryName}.entry.api.json`);
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

	// Copy the resolved tsconfig into the bundle (for downstream reproducibility).
	const bundleTsconfig = join(outMetaDir, "tsconfig.json");
	copyFileSync(tsconfigPath, bundleTsconfig);

	// Copy the bundle into each localPaths dir.
	for (const localPath of localPaths) {
		const dest = join(cwd, localPath);
		mkdirSync(dest, { recursive: true });
		copyFileSync(apiJsonPath, join(dest, apiJsonFilename));
		if (existsSync(tsdocMetadataPath)) copyFileSync(tsdocMetadataPath, join(dest, "tsdoc-metadata.json"));
		copyFileSync(bundleTsconfig, join(dest, "tsconfig.json"));
	}

	return { apiJsonPath, apiJsonFilename };
}

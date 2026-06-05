// packages/bundler/src/run.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	BuildTargetGroupsOptions,
	GenerateMetaOptions,
	MetaResult,
	RenderedOutput,
} from "@savvy-web/tsdown-plugins";
import {
	ReportPipelineLive,
	normalizeMetaOptions,
	packageJsonEntries,
	buildTargetGroups as realBuildTargetGroups,
	generateMeta as realGenerateMeta,
	renderReport,
	writeResolvedTsconfig,
} from "@savvy-web/tsdown-plugins";
import { Effect } from "effect";
import type { BuildConfig } from "./config.js";
import { parseArgs } from "./config.js";

export interface RunOptions {
	readonly cwd: string;
	readonly argv: ReadonlyArray<string>;
	/** Injectable for tests. */
	readonly buildTargetGroups?: (o: BuildTargetGroupsOptions) => Promise<void>;
	/** Injectable for tests: consumes rendered output (defaults to process.stdout.write). */
	readonly writeOutput?: (output: RenderedOutput) => void;
	/** Injectable for tests: returns the package version string. */
	readonly readVersion?: () => string;
	/** Injectable for tests: returns the package name. */
	readonly readPackageName?: () => string;
	/** Injectable for tests: writes the resolved tsconfig and returns its path (defaults to writeResolvedTsconfig, which writes to the OS temp dir). */
	readonly writeTsconfig?: (cwd: string) => string;
	/** Injectable for tests. */
	readonly generateMeta?: (o: GenerateMetaOptions) => Promise<MetaResult>;
	/** Injectable for tests: returns the package.json `exports` map. */
	readonly readExports?: () => Record<string, string> | undefined;
}

/** Read and parse package.json at cwd, returning an empty object on any error. */
function readPackageJson(cwd: string): { name?: string; version?: string; exports?: unknown; bin?: unknown } {
	try {
		return JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8")) as {
			name?: string;
			version?: string;
			exports?: unknown;
			bin?: unknown;
		};
	} catch {
		return {};
	}
}

/** Map entry names to export paths using the package exports map. index maps to ".". */
function deriveExportPaths(
	entries: Record<string, string>,
	exportsMap: Record<string, string> | undefined,
): Record<string, string> {
	const out: Record<string, string> = {};
	// entries keys are derived from exports keys by packageJsonEntries; recover the export key by matching the source path.
	const sourceToKey = new Map<string, string>();
	if (exportsMap) for (const [key, src] of Object.entries(exportsMap)) sourceToKey.set(src, key);
	for (const [entryName, src] of Object.entries(entries)) {
		out[entryName] = sourceToKey.get(src) ?? (entryName === "index" ? "." : `./${entryName}`);
	}
	return out;
}

/** Run a build from a normalized config. Pure orchestration; all IO injectable. */
export async function runBuild(config: BuildConfig, options: RunOptions): Promise<void> {
	const { target } = parseArgs(options.argv);
	const build = options.buildTargetGroups ?? realBuildTargetGroups;
	const cwd = options.cwd;
	const pkg = readPackageJson(cwd);

	const version = options.readVersion ? options.readVersion() : (pkg.version ?? "0.0.0");
	const packageName = options.readPackageName ? options.readPackageName() : (pkg.name ?? "unknown");

	const writeTsconfig = options.writeTsconfig ?? ((c: string) => writeResolvedTsconfig({ cwd: c }));
	const tsconfigPath = writeTsconfig(cwd);
	const entries = packageJsonEntries({ pkg, cwd });
	const exportsMap = options.readExports ? options.readExports() : (pkg.exports as Record<string, string> | undefined);
	const runGenerateMeta = options.generateMeta ?? realGenerateMeta;

	// --target meta: generate the api-model from the dev build's dts into localPaths. No tsdown build.
	if (target === "meta") {
		if (config.meta === undefined) {
			throw new Error("`savvy build --target meta` requires a `meta` option in the build config");
		}
		const norm = normalizeMetaOptions(config.meta);
		// dts basenames mirror the entry source: src/index.ts -> index, src/sub.ts -> sub.
		const dtsBasenames: Record<string, string> = {};
		for (const name of Object.keys(entries)) dtsBasenames[name] = name;
		await runGenerateMeta({
			cwd,
			packageName,
			tsconfigPath,
			dtsDir: join(cwd, "dist", "dev", "pkg"),
			entries: dtsBasenames,
			exportPaths: deriveExportPaths(entries, exportsMap),
			outMetaDir: join(cwd, "dist", "dev", "meta"),
			localPaths: norm.localPaths,
			tsdoc: norm.tsdoc,
		});
		const writeMetaOutput = options.writeOutput ?? ((o: RenderedOutput) => process.stdout.write(`${o.content}\n`));
		writeMetaOutput({
			target: "stdout",
			contentType: "text/plain",
			content: `meta: wrote api-model for ${packageName} to ${norm.localPaths.length} localPath(s)`,
		});
		return;
	}

	const startMs = Date.now();
	await build({
		cwd,
		version,
		entry: entries,
		tsconfigPath,
		groups: [target as "dev" | "npm"], // meta already returned above
		devManifest: config.devManifest,
		externals: config.externals,
		...(config.transform !== undefined ? { transform: config.transform } : {}),
	});

	// --target npm with meta set: emit the meta/ release-asset bundle alongside pkg/.
	if (target === "npm" && config.meta !== undefined) {
		const norm = normalizeMetaOptions(config.meta);
		const dtsBasenames: Record<string, string> = {};
		for (const name of Object.keys(entries)) dtsBasenames[name] = name;
		await runGenerateMeta({
			cwd,
			packageName,
			tsconfigPath,
			dtsDir: join(cwd, "dist", "prod", "npm", "pkg"),
			entries: dtsBasenames,
			exportPaths: deriveExportPaths(entries, exportsMap),
			outMetaDir: join(cwd, "dist", "prod", "npm", "meta"),
			localPaths: [],
			tsdoc: norm.tsdoc,
		});
	}

	const totalMs = Date.now() - startMs;

	// Build a minimal BuildReport from the completed build
	const reportEntries = Object.keys(entries);
	const report = {
		package: packageName,
		targetGroups: [
			{
				id: target,
				entries: reportEntries,
				emittedFiles: [],
				timings: { totalMs },
				warnings: [],
				errors: [],
			},
		],
	};

	const explicitFormat = config.output?.format;
	const rendered = await Effect.runPromise(
		renderReport([report], {
			...(explicitFormat !== undefined ? { explicitFormat } : {}),
			noColor: process.env.NO_COLOR !== undefined || !process.stdout.isTTY,
		}).pipe(Effect.provide(ReportPipelineLive)),
	);

	const writeOutput = options.writeOutput ?? ((o: RenderedOutput) => process.stdout.write(`${o.content}\n`));
	for (const output of rendered) {
		writeOutput(output);
	}
}

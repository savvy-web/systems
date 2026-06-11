// packages/bundler/src/run.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	BuildGroupSpec,
	BuildTargetGroupsOptions,
	EntryOverride,
	GenerateMetaOptions,
	JsxConfig,
	MetaResult,
	PublishTargets,
	RenderedOutput,
	RunExeBuildOptions,
	TargetResolution,
	TsconfigJsx,
} from "@savvy-web/tsdown-plugins";
import {
	ConfigValidator,
	ConfigValidatorLive,
	ReportPipelineLive,
	createEntryName,
	normalizeExeOptions,
	normalizeMetaOptions,
	packageJsonEntries,
	readTsconfigJsx,
	buildTargetGroups as realBuildTargetGroups,
	generateMeta as realGenerateMeta,
	runExeBuild as realRunExeBuild,
	writeTargetsBinding as realWriteTargetsBinding,
	removeDeclarationMaps,
	renderReport,
	resolveJsxConfig,
	resolveTargets,
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
	/** Injectable for tests: returns package.json publishConfig.targets, or undefined. */
	readonly readPublishTargets?: (() => PublishTargets | undefined) | undefined;
	/** Injectable for tests: writes the target binding artifact. */
	readonly writeTargetsBinding?: ((cwd: string, resolution: TargetResolution) => string) | undefined;
	/** Injectable for tests: reads the jsx-relevant tsconfig compilerOptions slice. */
	readonly readTsconfigJsx?: (() => TsconfigJsx) | undefined;
	/** Injectable for tests. */
	readonly runExeBuild?: ((o: RunExeBuildOptions) => Promise<void>) | undefined;
	/** Injectable for tests: returns the package os/cpu arrays. */
	readonly readOsCpu?: (() => { os: ReadonlyArray<string>; cpu: ReadonlyArray<string> }) | undefined;
}

/** Read and parse package.json at cwd, returning an empty object on any error. */
function readPackageJson(cwd: string): {
	name?: string;
	version?: string;
	exports?: unknown;
	bin?: unknown;
	publishConfig?: unknown;
	os?: unknown;
	cpu?: unknown;
} {
	try {
		return JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8")) as {
			name?: string;
			version?: string;
			exports?: unknown;
			bin?: unknown;
			publishConfig?: unknown;
			os?: unknown;
			cpu?: unknown;
		};
	} catch {
		return {};
	}
}

/** Resolve the prod build groups and the target binding from publishConfig.targets (or the single-npm default). */
function deriveProdGroups(
	targets: PublishTargets | undefined,
	baseName: string,
): { groups: ReadonlyArray<BuildGroupSpec>; resolution: TargetResolution } {
	const effective: PublishTargets = targets !== undefined && Object.keys(targets).length > 0 ? targets : { npm: true };
	const resolution = resolveTargets({ targets: effective, baseName });
	return { groups: resolution.groups.map((g) => ({ id: g.id, name: g.name })), resolution };
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

	const readJsx = options.readTsconfigJsx ?? ((): TsconfigJsx => readTsconfigJsx(cwd));
	const jsx: JsxConfig | undefined = resolveJsxConfig(readJsx(), config.jsx);
	const writeTsconfig =
		options.writeTsconfig ??
		((c: string) =>
			writeResolvedTsconfig({
				cwd: c,
				...(jsx?.runtime === "automatic" ? { jsx: "react-jsx", jsxImportSource: jsx.importSource } : {}),
				...(jsx?.runtime === "classic" ? { jsx: "react" } : {}),
			}));
	const tsconfigPath = writeTsconfig(cwd);
	const entries = packageJsonEntries({ pkg, cwd });
	const exportsMap = options.readExports ? options.readExports() : (pkg.exports as Record<string, string> | undefined);
	const runGenerateMeta = options.generateMeta ?? realGenerateMeta;
	const readPublishTargets =
		options.readPublishTargets ??
		(() => {
			// Only the new map form (Record) drives multi-target; ignore legacy array-form targets.
			const declared = (pkg.publishConfig as { targets?: unknown } | undefined)?.targets;
			return declared !== undefined && !Array.isArray(declared) && typeof declared === "object"
				? (declared as PublishTargets)
				: undefined;
		});
	const publishTargets = readPublishTargets();
	const writeBinding = options.writeTargetsBinding ?? realWriteTargetsBinding;

	// Fast-fail config validation: run BEFORE any build branch so every target path is gated.
	const osCpuForValidate = options.readOsCpu
		? options.readOsCpu()
		: { os: (pkg.os as string[] | undefined) ?? [], cpu: (pkg.cpu as string[] | undefined) ?? [] };
	await Effect.runPromise(
		Effect.flatMap(ConfigValidator, (v) =>
			v.validate({
				baseName: packageName,
				hasExports: exportsMap !== undefined && Object.keys(exportsMap).length > 0,
				...(publishTargets !== undefined ? { targets: publishTargets } : {}),
				...(config.exe !== undefined ? { exe: config.exe } : {}),
				osCpu: osCpuForValidate,
				...(config.meta !== undefined ? { meta: config.meta } : {}),
			}),
		).pipe(Effect.provide(ConfigValidatorLive)),
	);

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

	// --target exe: compile SEA binaries via @tsdown/exe. No tsdown library build.
	if (target === "exe") {
		if (config.exe === undefined) {
			throw new Error("`savvy build --target exe` requires an `exe` option in the build config");
		}
		const specs = normalizeExeOptions(config.exe, osCpuForValidate);
		const exe = options.runExeBuild ?? realRunExeBuild;
		await exe({ cwd, outDir: join(cwd, "dist", "dev", "pkg", "bin"), specs });
		const writeExeOutput = options.writeOutput ?? ((o: RenderedOutput) => process.stdout.write(`${o.content}\n`));
		writeExeOutput({
			target: "stdout",
			contentType: "text/plain",
			content: `exe: compiled ${specs.length} binary/binaries for ${packageName}`,
		});
		return;
	}

	// Per-entry format overrides: pin specific export paths to their own format/bundling.
	// Entries come from packageJsonEntries (the authoritative, filtered entry map: it drops
	// non-.ts exports, resolves object exports, rewrites /dist/*.js -> /src/*.ts, skips .json,
	// and includes bin). Override export paths are flattened to entry names via createEntryName.
	let overridePartitions: EntryOverride[] = [];
	let baseEntries: Record<string, string> = entries;
	let dualExports: ReadonlySet<string> | undefined;
	if (config.overrides) {
		const partitions: EntryOverride[] = [];
		const overriddenEntryNames = new Set<string>();
		const baseFormatHasCjs = (config.format ?? ["esm"]).includes("cjs");
		const dualExportKeys = new Set<string>();
		const exportPathByEntry = deriveExportPaths(entries, exportsMap); // entryName -> export key
		for (const ov of config.overrides) {
			const partEntry: Record<string, string> = {};
			for (const exportPath of ov.entries) {
				// Require the canonical package.json exports-key form. A non-canonical value like
				// "changesets/markdownlint" would still flatten to a valid entry name and build the
				// JS, but its dualExports key would not match the manifest's "./"-prefixed export key,
				// silently dropping the require condition. Fail loudly instead.
				if (exportPath !== "." && !exportPath.startsWith("./")) {
					throw new Error(
						`overrides: entry "${exportPath}" must be a canonical export path — use "." for the root or a "./"-prefixed subpath (e.g. "./changesets/markdownlint")`,
					);
				}
				const entryName = createEntryName(exportPath, false);
				const src = entries[entryName];
				if (src === undefined) {
					throw new Error(
						`overrides: export path "${exportPath}" (entry "${entryName}") is not a build entry of ${packageName}`,
					);
				}
				partEntry[entryName] = src;
				overriddenEntryNames.add(entryName);
				if ((ov.format ?? config.format ?? ["esm"]).includes("cjs")) dualExportKeys.add(exportPath);
			}
			partitions.push({
				entry: partEntry,
				...(ov.format !== undefined ? { format: ov.format } : {}),
				...(ov.externals !== undefined ? { externals: ov.externals } : {}),
				...(ov.bundle !== undefined ? { bundle: ov.bundle } : {}),
				...(ov.bundleNodeModules !== undefined ? { bundleNodeModules: ov.bundleNodeModules } : {}),
				...(ov.bundledPackages !== undefined ? { bundledPackages: ov.bundledPackages } : {}),
				...(ov.dtsExternals !== undefined ? { dtsExternals: ov.dtsExternals } : {}),
			});
		}
		const onlyBase: Record<string, string> = {};
		for (const [name, src] of Object.entries(entries)) {
			if (overriddenEntryNames.has(name)) continue;
			onlyBase[name] = src;
			if (baseFormatHasCjs) dualExportKeys.add(exportPathByEntry[name] ?? (name === "index" ? "." : `./${name}`));
		}
		overridePartitions = partitions;
		baseEntries = onlyBase;
		dualExports = dualExportKeys;
	}

	const startMs = Date.now();
	// dev: one dev group named after the base; npm: all resolved prod groups (meta already returned above).
	const { groups, resolution } =
		target === "dev"
			? { groups: [{ id: "dev", name: packageName }] as ReadonlyArray<BuildGroupSpec>, resolution: undefined }
			: deriveProdGroups(publishTargets, packageName);
	await build({
		cwd,
		version,
		entry: config.overrides !== undefined ? baseEntries : entries,
		tsconfigPath,
		groups,
		devManifest: config.devManifest,
		externals: config.externals,
		...(config.bundledPackages !== undefined ? { bundledPackages: config.bundledPackages } : {}),
		...(config.dtsExternals !== undefined ? { dtsExternals: config.dtsExternals } : {}),
		...(config.bundleNodeModules !== undefined ? { bundleNodeModules: config.bundleNodeModules } : {}),
		...(config.bundle !== undefined ? { bundle: config.bundle } : {}),
		...(config.minify !== undefined ? { minify: config.minify } : {}),
		...(config.transform !== undefined ? { transform: config.transform } : {}),
		...(jsx !== undefined ? { jsx } : {}),
		...(config.format !== undefined ? { format: config.format } : {}),
		...(config.define !== undefined ? { define: config.define } : {}),
		...(overridePartitions.length > 0 ? { overrides: overridePartitions } : {}),
		...(dualExports !== undefined ? { dualExports } : {}),
	});

	// Write the target-to-group binding for the release action (prod only).
	if (target === "prod" && resolution !== undefined) {
		writeBinding(cwd, resolution);
	}

	// --target prod with meta set: emit the meta/ release-asset bundle alongside the canonical group's pkg/.
	if (target === "prod" && config.meta !== undefined) {
		const metaGroup = groups.find((g) => g.name === packageName) ?? groups[0];
		const metaGroupId = metaGroup?.id ?? "npm";
		const norm = normalizeMetaOptions(config.meta);
		const dtsBasenames: Record<string, string> = {};
		for (const name of Object.keys(entries)) dtsBasenames[name] = name;
		await runGenerateMeta({
			cwd,
			packageName,
			tsconfigPath,
			dtsDir: join(cwd, "dist", "prod", metaGroupId, "pkg"),
			entries: dtsBasenames,
			exportPaths: deriveExportPaths(entries, exportsMap),
			outMetaDir: join(cwd, "dist", "prod", metaGroupId, "meta"),
			localPaths: [],
			tsdoc: norm.tsdoc,
		});
	}

	// Strip declaration source-maps from the PUBLISHED prod pkg/ dirs. They are emitted for
	// meta generation (API Extractor reads them for original-source positions, consumed in the
	// block above), but reference .ts sources the tarball does not ship — dead weight that leaks
	// local paths. Done after meta so prod meta still sees them; dev keeps them for `--target meta`.
	if (target === "prod") {
		for (const g of groups) removeDeclarationMaps(join(cwd, "dist", "prod", g.id, "pkg"));
	}

	const totalMs = Date.now() - startMs;

	// Build a minimal BuildReport from the completed build
	const reportEntries = Object.keys(entries);
	const report = {
		package: packageName,
		targetGroups: groups.map((g) => ({
			id: g.id,
			entries: reportEntries,
			emittedFiles: [],
			timings: { totalMs },
			warnings: [],
			errors: [],
		})),
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

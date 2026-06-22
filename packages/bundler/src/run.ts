// packages/bundler/src/run.ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
	BuildGroupSpec,
	BuildReport,
	BuildTargetGroupsOptions,
	EntryOverride,
	GenerateMetaOptions,
	JsxConfig,
	MetaResult,
	NextVersions,
	PublishTargets,
	RenderedOutput,
	RunExeBuildOptions,
	TargetResolution,
	TsconfigJsx,
} from "@savvy-web/tsdown-plugins";
import {
	BuildCollector,
	ConfigValidator,
	ConfigValidatorLive,
	ReportPipelineLive,
	buildEmittedManifest,
	computeExeFileName,
	createEntryName,
	deriveExportPaths,
	normalizeExeOptions,
	normalizeLooseFiles,
	packageJsonEntries,
	readTsconfigJsx,
	buildTargetGroups as realBuildTargetGroups,
	runExeBuild as realRunExeBuild,
	writeTargetsBinding as realWriteTargetsBinding,
	removeDeclarationMaps,
	renderReport,
	resolveJsxConfig,
	resolveTargets,
	runMetaPass,
	writeIssuesArtifact,
	writeResolvedTsconfig,
} from "@savvy-web/tsdown-plugins";
import { Effect } from "effect";
import type { BuildConfig } from "./config.js";
import { parseArgs } from "./config.js";

/** @public */
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
	/** Injectable for tests: resolves next release versions for the optimistic meta rewrite. */
	readonly resolveNextVersions?: ((cwd: string) => Promise<NextVersions>) | undefined;
	/** Injectable issues-artifact writer (defaults to writeIssuesArtifact). */
	readonly writeIssues?: (opts: {
		cwd: string;
		target: "dev" | "prod";
		reports: ReadonlyArray<BuildReport>;
		now?: () => Date;
	}) => string | undefined;
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

/**
 * Fast-fail validation for `outSubdir` overrides, run on EVERY target path. The dev/prod override-partition
 * loop already validates these (and all other overrides) before building, but `--target meta` returns early
 * (before that loop) and remaps meta dts basenames via `applySubdirMetaEntries` — which assumes validated
 * input. Without this guard, a malformed `outSubdir` override (more than one entry, a non-canonical export
 * path, or an export path that is not a real build entry) would silently remap a wrong/nonexistent key on the
 * meta path. Mirrors the override loop's conditions and messages verbatim so every target path fast-fails
 * identically. No-op when there are no overrides or none set `outSubdir`.
 */
function validateSubdirOverrides(
	overrides: ReadonlyArray<{ entries: ReadonlyArray<string>; outSubdir?: string | undefined }> | undefined,
	entries: Record<string, string>,
	packageName: string,
): void {
	if (overrides === undefined) return;
	for (const ov of overrides) {
		if (ov.outSubdir === undefined) continue;
		if (ov.entries.length !== 1) {
			throw new Error(
				`overrides: outSubdir "${ov.outSubdir}" must pin exactly one export path (got ${ov.entries.length})`,
			);
		}
		const exportPath = ov.entries[0];
		if (exportPath !== "." && !exportPath.startsWith("./")) {
			throw new Error(
				`overrides: entry "${exportPath}" must be a canonical export path — use "." for the root or a "./"-prefixed subpath (e.g. "./changesets/markdownlint")`,
			);
		}
		const flatName = createEntryName(exportPath, false);
		if (entries[flatName] === undefined) {
			throw new Error(
				`overrides: export path "${exportPath}" (entry "${flatName}") is not a build entry of ${packageName}`,
			);
		}
	}
}

/** Run a build from a normalized config. Pure orchestration; all IO injectable. @public */
export async function runBuild(config: BuildConfig, options: RunOptions): Promise<void> {
	const { target, noExe, verbose } = parseArgs(options.argv);
	const build = options.buildTargetGroups ?? realBuildTargetGroups;
	const cwd = options.cwd;
	const pkg = readPackageJson(cwd);

	const version = options.readVersion ? options.readVersion() : (pkg.version ?? "0.0.0");
	const packageName = options.readPackageName ? options.readPackageName() : (pkg.name ?? "unknown");
	const collector = new BuildCollector();

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
	const exportsMap = options.readExports ? options.readExports() : (pkg.exports as Record<string, string> | undefined);
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
				...(config.meta !== undefined && config.meta !== false ? { meta: config.meta } : {}),
				...(config.looseFiles !== undefined ? { looseFiles: config.looseFiles } : {}),
			}),
		).pipe(Effect.provide(ConfigValidatorLive)),
	);

	// Resolve the SEA spec once (per-platform package = one spec, one target). The emitted filename is
	// computed (not read from disk) so `--no-exe` can program the same manifest without a build, and the
	// exe entry source is excluded from the JS pass so a pure-binary package emits no dead JS.
	const exeSpecs = config.exe !== undefined ? normalizeExeOptions(config.exe, osCpuForValidate) : [];
	// A package's exports["."] resolves to exactly one SEA, so the manifest rewrite and source
	// exclusion below read exeSpecs[0]/targets[0]. Enforce that singleton here rather than let a
	// multi-spec/multi-target config silently program the manifest for only the first binary while
	// runExeBuild compiles them all. Cross-platform binaries ship as separate per-platform packages.
	if (config.exe !== undefined && (exeSpecs.length !== 1 || (exeSpecs[0]?.targets.length ?? 0) !== 1)) {
		throw new Error(
			`exe build requires exactly one binary with one target (got ${exeSpecs.length} spec(s), ${exeSpecs[0]?.targets.length ?? 0} target(s) on the first). A package's exports["."] resolves to a single SEA — cross-platform binaries must each ship as their own per-platform package.`,
		);
	}
	const exeSpec = exeSpecs[0];
	const exeTarget = exeSpec?.targets[0];
	const exeFileName = exeSpec && exeTarget ? computeExeFileName(exeSpec.fileName, exeTarget) : undefined;
	const exeEntrySource = exeSpec?.entry ?? "./src/bin.ts";
	const exeRewrite =
		config.exe !== undefined && exeFileName !== undefined
			? { source: exeEntrySource, fileName: exeFileName, dir: "bin" }
			: undefined;

	const entries = packageJsonEntries({
		pkg,
		cwd,
		...(config.exe !== undefined ? { excludeSources: [exeEntrySource] } : {}),
	});
	const hasJsEntries = Object.keys(entries).length > 0;

	// Fast-fail outSubdir-override validation: run before any early-return branch so every target
	// path rejects a bad outSubdir override consistently.
	validateSubdirOverrides(config.overrides, entries, packageName);

	// --target meta is SOFT-DEPRECATED: meta is now emitted by --target prod (per group, with
	// resolved + optionally optimistic deps). Warn and no-op so external escape-hatch scripts that
	// still pass --target meta do not hard-fail. Full removal (flag + build:meta task/scripts) lands
	// in a follow-up branch.
	if (target === "meta") {
		const writeMetaOutput = options.writeOutput ?? ((o: RenderedOutput) => process.stdout.write(`${o.content}\n`));
		writeMetaOutput({
			target: "stdout",
			contentType: "text/plain",
			content: `meta: --target meta is deprecated and now a no-op; meta is emitted by --target prod (${packageName}).`,
		});
		return;
	}

	// --target exe: compile SEA binaries via @tsdown/exe. No tsdown library build.
	if (target === "exe") {
		if (config.exe === undefined) {
			throw new Error("`savvy build --target exe` requires an `exe` option in the build config");
		}
		const exe = options.runExeBuild ?? realRunExeBuild;
		await exe({
			cwd,
			outDir: join(cwd, "dist", "dev", "pkg", "bin"),
			specs: exeSpecs,
			collector,
			groupId: "dev",
			verbose,
		});
		const writeExeOutput = options.writeOutput ?? ((o: RenderedOutput) => process.stdout.write(`${o.content}\n`));
		writeExeOutput({
			target: "stdout",
			contentType: "text/plain",
			content: `exe: compiled ${exeSpecs.length} binary/binaries for ${packageName}`,
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
	// Export paths of overrides that build into an isolated `<group>/pkg/<outSubdir>/` sub-package.
	// Threaded to buildTargetGroups so the manifest maps each to `<subdir>/index.*`.
	const subdirExports = new Set<string>();
	if (config.overrides) {
		const partitions: EntryOverride[] = [];
		const overriddenEntryNames = new Set<string>();
		const baseFormatHasCjs = (config.format ?? ["esm"]).includes("cjs");
		const dualExportKeys = new Set<string>();
		const exportPathByEntry = deriveExportPaths(entries, exportsMap); // entryName -> export key
		for (const ov of config.overrides) {
			// An outSubdir partition is an isolated single-export sub-package — pin exactly one export.
			if (ov.outSubdir !== undefined && ov.entries.length !== 1) {
				throw new Error(
					`overrides: outSubdir "${ov.outSubdir}" must pin exactly one export path (got ${ov.entries.length})`,
				);
			}
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
				const flatName = createEntryName(exportPath, false);
				const src = entries[flatName];
				if (src === undefined) {
					throw new Error(
						`overrides: export path "${exportPath}" (entry "${flatName}") is not a build entry of ${packageName}`,
					);
				}
				// An outSubdir partition emits a barrel at `<subdir>/index.*`, so its output entry KEY
				// must be "index". The source lookup still uses the flattened name (the base entry key).
				const entryName = ov.outSubdir !== undefined ? "index" : flatName;
				partEntry[entryName] = src;
				overriddenEntryNames.add(flatName);
				if (ov.outSubdir !== undefined) subdirExports.add(exportPath);
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
				...(ov.platform !== undefined ? { platform: ov.platform } : {}),
				...(ov.css !== undefined ? { css: ov.css } : {}),
				...(ov.outSubdir !== undefined ? { outSubdir: ov.outSubdir } : {}),
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

	// Normalize after validation (which already surfaced any structural error). Pure; never throws here.
	const looseFiles = config.looseFiles !== undefined ? normalizeLooseFiles(config.looseFiles) : undefined;

	// dev: one dev group named after the base; npm: all resolved prod groups (meta already returned above).
	const { groups, resolution } =
		target === "dev"
			? { groups: [{ id: "dev", name: packageName }] as ReadonlyArray<BuildGroupSpec>, resolution: undefined }
			: deriveProdGroups(publishTargets, packageName);

	const explicitFormat = config.output?.format;
	const writeOutput = options.writeOutput ?? ((o: RenderedOutput) => process.stdout.write(`${o.content}\n`));
	const renderAndWrite = async (): Promise<void> => {
		const rendered = await Effect.runPromise(
			renderReport(collector.snapshot(packageName), {
				...(explicitFormat !== undefined ? { explicitFormat } : {}),
				verbose,
				noColor: process.env.NO_COLOR !== undefined || !process.stdout.isTTY,
			}).pipe(Effect.provide(ReportPipelineLive)),
		);
		for (const output of rendered) writeOutput(output);
	};

	// Persist the structured diagnostics artifact on every terminal path — success AND failure.
	// A failed build is exactly when an agent wants to read why, so write it before rethrowing too.
	// Best-effort: a write failure (read-only fs, missing parent, permissions) must never compound
	// or mask the build outcome — the dist build product (on success) is already emitted by here.
	const writeIssuesBestEffort = (): void => {
		if (target !== "dev" && target !== "prod") return;
		try {
			(options.writeIssues ?? writeIssuesArtifact)({ cwd, target, reports: collector.snapshot(packageName) });
		} catch {
			// intentionally swallowed — see above
		}
	};

	try {
		// A pure-binary (exe-only) package has no JS entries; running tsdown would throw "No input files".
		// Skip the library build — the manifest is emitted standalone in the exe step below.
		if (hasJsEntries || config.exe === undefined) {
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
				...(subdirExports.size > 0 ? { subdirExports } : {}),
				...(looseFiles !== undefined ? { looseFiles } : {}),
				...(exeRewrite !== undefined ? { exeRewrite } : {}),
				collector,
				verbose,
			});
		}

		// Write the target-to-group binding for the release action (prod only).
		if (target === "prod" && resolution !== undefined) {
			writeBinding(cwd, resolution);
		}

		// --target prod: emit the meta/ bundle for EVERY prod group (consumers read non-canonical groups,
		// e.g. GitHub Actions), each against its own dist/prod/<group>/pkg so the .api.json carries that
		// group's package name. Copy the canonical group's bundle into meta.localPaths. Optionally rewrite
		// versions optimistically. undefined -> default options; object -> overrides; false -> skip.
		// An exe-only package has no JS entries (no dts), so there is nothing for API Extractor to read.
		if (target === "prod" && config.meta !== false && (config.exe === undefined || hasJsEntries)) {
			const ci = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
			await runMetaPass({
				cwd,
				packageName,
				tsconfigPath,
				groups,
				entries,
				exportsMap,
				overrides: config.overrides,
				meta: config.meta ?? {},
				collector,
				ci,
				...(options.generateMeta !== undefined ? { generateMeta: options.generateMeta } : {}),
				...(options.resolveNextVersions !== undefined ? { resolveNextVersions: options.resolveNextVersions } : {}),
			});
		}

		// Strip declaration source-maps from the PUBLISHED prod pkg/ dirs. They are emitted for
		// meta generation (API Extractor reads them for original-source positions, consumed in the
		// block above), but reference .ts sources the tarball does not ship — dead weight that leaks
		// local paths. Done after meta so prod meta still sees them; dev keeps them for `--target meta`.
		if (target === "prod") {
			for (const g of groups) removeDeclarationMaps(join(cwd, "dist", "prod", g.id, "pkg"));
		}

		// SEA step: compile the binary into each built group's pkg/bin and program its manifest. Runs AFTER
		// the library build so the dev `clean` cannot wipe the binary. For an exe-only package (no JS pass)
		// the manifest is emitted standalone here, since the emitManifest plugin only runs inside the JS pass.
		if (config.exe !== undefined && exeSpec !== undefined && exeRewrite !== undefined && exeFileName !== undefined) {
			const runExe = options.runExeBuild ?? realRunExeBuild;
			const groupOutDir = (g: BuildGroupSpec): string =>
				target === "dev" ? join(cwd, "dist", "dev", "pkg") : join(cwd, "dist", "prod", g.id, "pkg");
			for (const g of groups) {
				const outDir = groupOutDir(g);
				if (!hasJsEntries) {
					// No JS pass ran, so emit the manifest + LICENSE/README ourselves.
					const manifest = await buildEmittedManifest({
						pkg,
						targetGroup: { id: g.id, name: g.name, isProd: target === "prod" },
						devManifest: config.devManifest,
						...(config.transform !== undefined ? { transform: config.transform } : {}),
						exeRewrite,
					});
					mkdirSync(outDir, { recursive: true });
					writeFileSync(join(outDir, "package.json"), `${JSON.stringify(manifest, null, "\t")}\n`);
					for (const file of ["LICENSE", "README.md"]) {
						try {
							copyFileSync(join(cwd, file), join(outDir, file));
						} catch {
							// optional file absent — skip
						}
					}
				}
				if (!noExe) {
					const binDir = join(outDir, "bin");
					await runExe({ cwd, outDir: binDir, specs: exeSpecs, collector, groupId: g.id, verbose });
					// Drift guard: the manifest points at the computed name; assert the compiler emitted it.
					// Skipped when a fake runExeBuild is injected (tests), which writes nothing.
					if (options.runExeBuild === undefined && !existsSync(join(binDir, exeFileName))) {
						throw new Error(
							`exe: expected compiled binary at ${join(binDir, exeFileName)} but it is missing — ` +
								`tsdown's emitted name may have drifted from computeExeFileName`,
						);
					}
				}
			}
		}
	} catch (err) {
		// Surface whatever diagnostics were captured before the failure, then rethrow.
		await renderAndWrite();
		writeIssuesBestEffort();
		throw err;
	}

	await renderAndWrite();
	writeIssuesBestEffort();
}

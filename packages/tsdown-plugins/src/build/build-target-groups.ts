// packages/tsdown-plugins/src/build/build-target-groups.ts
import { dirname, join } from "node:path";
import type { Plugin } from "rolldown";
import type { JsxConfig } from "../jsx/config.js";
import type { TargetGroupRef } from "../manifest/emit-manifest.js";
import { emitManifest } from "../manifest/emit-manifest.js";
import type { DualExports, ExeRewrite, Json } from "../manifest/transform.js";
import type { BuildCollector, PassKind } from "../report/collector.js";
import { buildMetricsPlugin } from "../report/metrics-plugin.js";
import { createTimer } from "../report/timer.js";
import { createTsdownLogger } from "../report/tsdown-logger.js";
import { cjsDefaultInterop } from "./cjs-default-interop.js";
import type { NormalizedLooseFile } from "./loose-files.js";
import { nodeBuiltinDefaultInterop } from "./node-builtin-default-interop.js";
import { syncPublicDir } from "./sync-public.js";
import type { BuildFormat, BuildGroupSpec, BuildPlatform } from "./target-groups.js";
import { deriveDtsPassOptions, deriveTargetGroupOptions, outDirFor } from "./target-groups.js";

/** Signature compatible with tsdown's `build(inlineConfig)`. */
export type TsdownBuild = (config: Record<string, unknown>) => Promise<unknown>;

/**
 * CSS handling for a partition's JS pass, forwarded VERBATIM to tsdown's `css` option (consumed
 * by `@tsdown/css`). Structurally typed so tsdown-plugins takes no dependency on `@tsdown/css`.
 * The package whose runtime is built must install `@tsdown/css`; tsdown loads it lazily.
 */
export interface CssOptions {
	readonly modules?:
		| boolean
		| { readonly localsConvention?: string; readonly namedExport?: boolean; readonly [k: string]: unknown };
	readonly [k: string]: unknown;
}

/**
 * One entry partition built with its own format + bundling posture, layered into the
 * SAME outDir as the base build (clean:false). Anything omitted falls back to the base
 * build's value. `entry` is a subset of the package's entries (entryName -> source path).
 */
export interface EntryOverride {
	readonly entry: Record<string, string>;
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
	readonly externals?: ReadonlyArray<string> | undefined;
	readonly bundle?: ReadonlyArray<string> | undefined;
	readonly bundleNodeModules?: boolean | undefined;
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
	readonly dtsExternals?: ReadonlyArray<string> | undefined;
	/** JS-pass platform for this partition. Defaults to the base "node". Use "browser" for a web runtime. */
	readonly platform?: BuildPlatform | undefined;
	/** CSS handling forwarded to tsdown's `css` option (JS pass only). Enables `@tsdown/css`. */
	readonly css?: CssOptions | undefined;
	/**
	 * Build this partition into `<groupOutDir>/<outSubdir>/` instead of the shared group root.
	 * Isolates a sub-package (e.g. an RSPress `./runtime`) so its bundleless per-file output cannot
	 * collide with the base partition's output and its barrel path is deterministic. The partition's
	 * entry should be `{ index: <barrel source> }` so it emits `<outSubdir>/index.js` + `<outSubdir>/index.d.ts`.
	 */
	readonly outSubdir?: string | undefined;
}

export interface BuildTargetGroupsOptions {
	readonly cwd: string;
	readonly version: string;
	readonly entry: Record<string, string>;
	readonly tsconfigPath: string;
	readonly groups: ReadonlyArray<BuildGroupSpec>;
	readonly devManifest: "preserve" | "resolve";
	readonly externals?: ReadonlyArray<string>;
	/**
	 * Packages externalized in the dts pass ONLY — emitted as `import ... from "..."`
	 * references in the `.d.ts` rather than inlined — while the JS pass still bundles
	 * them per `bundleNodeModules`. The dts pass `neverBundle` becomes the union of
	 * `externals` and `dtsExternals`. Use when a dependency's types cannot be safely
	 * inlined into a single bundled declaration file (e.g. effect's cross-module
	 * `declare module` augmentations, which inline into conflicting interface
	 * extensions in consumers). The JS pass is unaffected.
	 */
	readonly dtsExternals?: ReadonlyArray<string> | undefined;
	/**
	 * External packages whose declarations are inlined into the bundled dts
	 * (rslib `dtsBundledPackages` equivalent). Forwarded to the dts pass as
	 * `deps.dts.alwaysBundle` alongside `skipNodeModulesBundle: true`; unlike
	 * `deps.onlyBundle` this does not enable tsdown's strict-mode check that
	 * errors on every unlisted transitive dependency. The JS pass is unaffected.
	 */
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
	/**
	 * Force-bundle node_modules (and workspace) JS dependencies that are not
	 * externalized, restoring the rslib bundle-everything-except-externals
	 * behavior. Sets tsdown `deps.skipNodeModulesBundle: false`; the dts pass
	 * posture mirrors the JS pass, so the bundled declarations are also
	 * self-contained. Defaults to false (current behavior).
	 */
	readonly bundleNodeModules?: boolean | undefined;
	/**
	 * Force-bundle (inline) these packages into the JS output (tsdown `deps.alwaysBundle`),
	 * even declared deps that would otherwise be auto-externalized. The inverse of
	 * `externals`. JS pass only; `alwaysBundle` is allowed alongside our `skipNodeModulesBundle:
	 * false` (the throw only fires when skipNodeModulesBundle is true).
	 */
	readonly bundle?: ReadonlyArray<string> | undefined;
	/** Output formats to emit. Defaults to esm-only when unset. */
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
	/**
	 * Minify the JS output of PROD groups only (dev is never minified). Defaults to
	 * false — this builder targets Node libraries where readable output is preferred.
	 */
	readonly minify?: boolean | undefined;
	readonly transform?: (args: { pkg: Json; targetGroup: TargetGroupRef }) => Json;
	/**
	 * Extra rolldown plugins, forwarded to BOTH the JS pass and the dts-only pass. A plugin
	 * with JS-lifecycle side effects (asset emitters, banner injectors) runs in both passes;
	 * the dts pass uses `emitDtsOnly`, so for esm-only builds it produces no JS chunks and most
	 * rolldown hooks are no-ops there. For DUAL (esm+cjs) builds, however, tsdown's dts pass
	 * still RE-EMITS the `.cjs` JS chunk and overwrites the JS pass's `.cjs` output — so a
	 * `renderChunk`/`generateBundle` plugin that must persist onto the final `.cjs` (e.g. the
	 * built-in cjs-default-interop) has to run in the dts pass too. A caller relying on a hook
	 * firing exactly once should guard the second invocation.
	 */
	readonly extraPlugins?: ReadonlyArray<Plugin>;
	/** JSX transform settings forwarded to rolldown's inputOptions. */
	readonly jsx?: JsxConfig | undefined;
	/**
	 * Compile-time global replacements forwarded to BOTH the JS and dts passes' `define`.
	 * Build-wide (shared by every entry partition); merged after the auto-injected
	 * `process.env.__PACKAGE_VERSION__` so a user key of the same name wins.
	 */
	readonly define?: Record<string, string> | undefined;
	/**
	 * Entry partitions with their own format/bundling, built into the same outDir after
	 * the base entries. Used for per-entry format overrides (e.g. one CJS entry in an
	 * otherwise ESM-only package). The base `entry` must already EXCLUDE these entries.
	 */
	readonly overrides?: ReadonlyArray<EntryOverride> | undefined;
	/**
	 * Standalone bundled output files emitted at literal paths into each group's pkg/ dir,
	 * outside the exports/dts/meta graph (e.g. pnpm config-dependency pnpmfiles). Each runs as
	 * one extra single-entry, bundled (unbundle:false), no-dts, no-manifest pass per group,
	 * inheriting the group's bundleNodeModules/bundle/externals posture so the file is
	 * self-contained. Caller passes the normalized form (see normalizeLooseFiles).
	 */
	readonly looseFiles?: ReadonlyArray<NormalizedLooseFile> | undefined;
	/**
	 * Which export keys get a CJS `require` condition in the emitted manifest. Pass a Set
	 * when overrides give different entries different formats; omit for the uniform
	 * `format`-includes-cjs behavior.
	 */
	readonly dualExports?: DualExports | undefined;
	/** Export keys built into a `<key>/index.*` subdir (e.g. an RSPress `./runtime`). */
	readonly subdirExports?: ReadonlySet<string> | undefined;
	/** When set, rewrite the emitted manifest's exports/bin values equal to the exe source to the SEA path and add it to `files`. */
	readonly exeRewrite?: ExeRewrite | undefined;
	/** Injectable for tests; defaults to tsdown's build. */
	readonly build?: TsdownBuild;
	/** When set, muzzle tsdown (silent + customLogger) and capture metrics/timing into this collector. */
	readonly collector?: BuildCollector | undefined;
	/** Compute gzip sizes for emitted files (verbose render). Forwarded to the metrics plugin. */
	readonly verbose?: boolean | undefined;
}

/**
 * Run tsdown.build() per TargetGroup. Composable so the escape hatch gets multi-group too.
 *
 * Each group runs TWO passes to the SAME outDir:
 *  1. JS pass — per-module JS (`unbundle: true`, `dts: false`), with the `emitManifest` plugin
 *     and the `public/` copy. Default `clean: true` gives it a fresh outDir.
 *  2. dts pass — bundled declarations only (`unbundle: false`, `dts: { emitDtsOnly: true }`,
 *     `clean: false`). No manifest plugin, no copy, no sourcemaps. `clean: false` is load-bearing:
 *     it must NOT wipe the JS the first pass just wrote.
 *
 * Why two passes: tsdown's `unbundle` maps to rolldown `output.preserveModules` for the whole
 * build (JS and the dts plugin share it), so a single pass cannot give per-module JS + bundled
 * dts. Per-module dts breaks type portability (TS2883); bundling the JS re-bundles workspace
 * consumers. The split keeps per-module JS AND rolled-up, self-contained declarations.
 */
export async function buildTargetGroups(options: BuildTargetGroupsOptions): Promise<void> {
	const build: TsdownBuild = options.build ?? ((await import("tsdown")).build as unknown as TsdownBuild);
	const publicDir = join(options.cwd, "public");

	const collector = options.collector;
	const verbose = options.verbose ?? false;

	// Build a partial config that muzzles tsdown and records into the collector for one pass.
	// Returns {} when there is no collector, preserving the raw-tsdown path.
	const instrument = (groupId: string): Record<string, unknown> =>
		collector === undefined ? {} : { logLevel: "silent", customLogger: createTsdownLogger(collector, groupId) };

	const metricsPlugins = (groupId: string, pass: PassKind): Plugin[] =>
		collector === undefined ? [] : [buildMetricsPlugin(collector, groupId, pass, verbose)];

	// Run a build pass under a timer, recording elapsed into the collector.
	const timed = async (groupId: string, pass: PassKind, run: () => Promise<unknown>): Promise<void> => {
		const timer = createTimer();
		try {
			await run();
		} finally {
			if (collector !== undefined) collector.recordPassTiming(groupId, pass, timer.elapsed());
		}
	};

	for (const group of options.groups) {
		if (collector !== undefined) collector.registerGroup(group.id, Object.keys(options.entry));

		// Partition 0 is the base (options-level config); the rest come from options.overrides.
		const partitions: ReadonlyArray<EntryOverride> = [
			{
				entry: options.entry,
				...(options.format !== undefined ? { format: options.format } : {}),
				...(options.externals !== undefined ? { externals: options.externals } : {}),
				...(options.bundle !== undefined ? { bundle: options.bundle } : {}),
				...(options.bundleNodeModules !== undefined ? { bundleNodeModules: options.bundleNodeModules } : {}),
				...(options.bundledPackages !== undefined ? { bundledPackages: options.bundledPackages } : {}),
				...(options.dtsExternals !== undefined ? { dtsExternals: options.dtsExternals } : {}),
			},
			...(options.overrides ?? []),
		];

		for (let p = 0; p < partitions.length; p++) {
			const part = partitions[p];
			if (part === undefined) continue;
			const isBase = p === 0;
			const partExternals = part.externals;
			const partBundle = part.bundle;
			const partBundleNodeModules = part.bundleNodeModules;
			const partBundledPackages = part.bundledPackages;
			const partDtsExternals = part.dtsExternals;

			const deriveInput = {
				group: group.id,
				cwd: options.cwd,
				version: options.version,
				entry: part.entry,
				tsconfigPath: options.tsconfigPath,
				devManifest: options.devManifest,
				...(partExternals !== undefined ? { externals: partExternals } : {}),
				...(partBundledPackages !== undefined ? { bundledPackages: partBundledPackages } : {}),
				...(part.format !== undefined ? { format: part.format } : {}),
				...(options.minify !== undefined ? { minify: options.minify } : {}),
				...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
				...(options.define !== undefined ? { define: options.define } : {}),
				...(part.platform !== undefined ? { platform: part.platform } : {}),
			};
			const js = deriveTargetGroupOptions(deriveInput);
			const dts = deriveDtsPassOptions(deriveInput);
			const partOutDir = part.outSubdir !== undefined ? join(js.outDir, part.outSubdir) : js.outDir;
			const targetGroup: TargetGroupRef = { id: group.id, name: group.name, isProd: js.isProd };

			// For an outSubdir partition (an isolated bundleless sub-package, e.g. an RSPress
			// `./runtime`), the JS pass must emit the WHOLE source subtree as a per-file glob, NOT
			// just the modules reachable from the barrel's import graph. Real RSPress plugins
			// reference some runtime components ONLY by file path — via `globalUIComponents` and
			// `resolve.alias` — and never import them from the barrel, so a barrel-only (unbundle)
			// pass would drop those files and the consuming site fails with "Module not found" /
			// broken alias targets. Globbing over the barrel's source directory ships every file.
			// The barrel source is the single value in `part.entry` (e.g. `./src/runtime/index.tsx`);
			// its `dirname` is the sub-package root (`./src/runtime`). The dts pass below keeps the
			// single named barrel entry so it still rolls up one bundled `<subdir>/index.d.ts`.
			//
			// Test/declaration files are excluded so they do not emit into the runtime output.
			const srcDir = dirname(Object.values(part.entry)[0] ?? "");
			const jsEntry =
				part.outSubdir !== undefined
					? [
							`${srcDir}/**/*.{ts,tsx,mts,cts}`,
							`!${srcDir}/**/*.{test,spec}.{ts,tsx,mts,cts}`,
							`!${srcDir}/**/*.d.{ts,cts,mts}`,
						]
					: js.entry;

			// Manifest is emitted ONCE per group, by the base partition's JS pass, covering the
			// whole package's exports with per-entry dual conditions.
			const manifestPlugin = isBase
				? emitManifest({
						targetGroup,
						devManifest: options.devManifest,
						transform: options.transform,
						sourceDir: options.cwd,
						dual: options.dualExports ?? js.format.includes("cjs"),
						...(options.subdirExports !== undefined ? { subdirExports: options.subdirExports } : {}),
						...(options.exeRewrite !== undefined ? { exeRewrite: options.exeRewrite } : {}),
					})
				: undefined;

			// Pass 1: per-module JS. clean only on the very first partition (it owns the outDir).
			await timed(group.id, "js", () =>
				build({
					config: false,
					cwd: options.cwd,
					entry: jsEntry,
					outDir: partOutDir,
					format: js.format,
					platform: js.platform,
					sourcemap: js.sourcemap,
					minify: js.minify,
					unbundle: js.unbundle,
					clean: isBase ? js.clean : false,
					fixedExtension: js.fixedExtension,
					dts: js.dts,
					define: js.define,
					...instrument(group.id),
					...(part.css !== undefined ? { css: part.css } : {}),
					...(partExternals?.length || partBundleNodeModules || partBundle?.length
						? {
								deps: {
									...(partExternals?.length ? { neverBundle: partExternals } : {}),
									// alwaysBundle force-inlines these packages (inverse of neverBundle), even
									// declared deps tsdown would auto-externalize. Allowed alongside
									// skipNodeModulesBundle:false (the throw only fires when it is true).
									...(partBundle?.length ? { alwaysBundle: partBundle } : {}),
									...(partBundleNodeModules ? { skipNodeModulesBundle: false } : {}),
								},
							}
						: {}),
					...(js.cjsDefault !== undefined ? { cjsDefault: js.cjsDefault } : {}),
					...(js.jsx !== undefined ? { inputOptions: { jsx: js.jsx } } : {}),
					// nodeBuiltinDefaultInterop rewrites default imports of node: builtins to namespace
					// form so rolldown's CJS codegen emits correct interop (it otherwise accesses
					// `.default` on a bare `require("node:x")`, which is undefined). cjsDefaultInterop
					// promotes a default+named CJS entry chunk to module.exports = <default> (rslib
					// cjsInterop parity). Both are cjs-only and no-ops for esm.
					plugins: [
						...(manifestPlugin ? [manifestPlugin] : []),
						...(js.format.includes("cjs") ? [nodeBuiltinDefaultInterop(), cjsDefaultInterop()] : []),
						...(options.extraPlugins ?? []),
						...metricsPlugins(group.id, "js"),
					],
				}),
			);

			// Mirror public/ once, after the base partition's JS pass owns the outDir.
			if (isBase) syncPublicDir(publicDir, join(js.outDir, "public"));

			const dtsNeverBundle = [...(partExternals ?? []), ...(partDtsExternals ?? [])];

			// Pass 2: bundled dts for this partition's entries. Always clean:false.
			//
			// The dts pass's bundling posture tracks the JS pass's. There are three cases:
			//
			//  1. bundleNodeModules — the JS pass force-bundles all node_modules (rslib
			//     bundle-everything-except-externals). The dts must match: INLINE every
			//     node_modules type into the declarations (`skipNodeModulesBundle: false`),
			//     so the published package is self-contained and consumers need no extra
			//     declared deps for the inlined types. `dts.alwaysBundle` is then redundant,
			//     but include it when bundledPackages is also set (belt-and-suspenders).
			//  2. bundledPackages without bundleNodeModules — "inline ONLY these declarations,
			//     externalize the rest" (rslib dtsBundledPackages parity). onlyBundle would
			//     put tsdown's dts pass into strict mode (it errors on every reachable
			//     node_modules type dep not in onlyBundle), unworkable when transitive type
			//     deps cannot all be enumerated. Instead externalize all node_modules
			//     (`skipNodeModulesBundle: true`) and force-bundle only the listed packages
			//     via `deps.dts.alwaysBundle`. tsdown forbids skipNodeModulesBundle with the
			//     top-level deps.alwaysBundle, but deps.dts.alwaysBundle is exempt from that
			//     mutual-exclusion check and is consulted first in tsdown's external strategy,
			//     so the listed declarations still inline.
			//  3. neither — the existing leaf bundled-dts behavior; only neverBundle applies.
			//
			// Across ALL three branches the dts pass `neverBundle` is the UNION of `externals`
			// and `dtsExternals`: dtsExternals are externalized in the dts pass only (emitted as
			// import references in the .d.ts) while the JS pass still bundles them. The JS pass
			// neverBundle (above) carries `externals` only — never dtsExternals.
			await timed(group.id, "dts", () =>
				build({
					config: false,
					cwd: options.cwd,
					entry: dts.entry,
					outDir: partOutDir,
					format: dts.format,
					platform: dts.platform,
					sourcemap: dts.sourcemap,
					unbundle: dts.unbundle,
					clean: false,
					fixedExtension: dts.fixedExtension,
					dts: dts.dts,
					define: dts.define,
					...instrument(group.id),
					...(dtsNeverBundle.length > 0 || partBundleNodeModules || dts.bundledPackages
						? {
								deps: {
									...(dtsNeverBundle.length > 0 ? { neverBundle: dtsNeverBundle } : {}),
									...(partBundleNodeModules
										? {
												skipNodeModulesBundle: false,
												...(dts.bundledPackages ? { dts: { alwaysBundle: dts.bundledPackages } } : {}),
											}
										: dts.bundledPackages
											? { skipNodeModulesBundle: true, dts: { alwaysBundle: dts.bundledPackages } }
											: {}),
								},
							}
						: {}),
					...(dts.jsx !== undefined ? { inputOptions: { jsx: dts.jsx } } : {}),
					// The dts pass runs with emitDtsOnly, but for dual format tsdown still RE-EMITS the
					// `.cjs` JS chunk in this pass, overwriting the JS pass's footer'd `.cjs` with a
					// footer-less one (verified). Re-attach the interop plugins here so the footer lands on
					// the FINAL `.cjs` (this is the chunk that inlines vendor deps like vfile).
					plugins: [
						...(dts.format.includes("cjs") ? [nodeBuiltinDefaultInterop(), cjsDefaultInterop()] : []),
						...(options.extraPlugins ?? []),
						...metricsPlugins(group.id, "dts"),
					],
				}),
			);
		}

		// Loose files: one extra single-entry, bundled, no-dts, no-manifest pass each, into the
		// same pkg/ outDir. They are outside the exports graph (no manifest entry, no dts, no
		// meta). clean:false always — the base partition already owns/cleaned the outDir.
		const looseOutDir = outDirFor(options.cwd, group.id);
		const isProdGroup = group.id !== "dev";
		const looseDeps = {
			...(options.externals?.length ? { neverBundle: options.externals } : {}),
			...(options.bundle?.length ? { alwaysBundle: options.bundle } : {}),
			...(options.bundleNodeModules ? { skipNodeModulesBundle: false } : {}),
		};
		for (const lf of options.looseFiles ?? []) {
			const hasCjs = lf.format === "cjs";
			await timed(group.id, "loose", () =>
				build({
					config: false,
					cwd: options.cwd,
					entry: { [lf.entryName]: lf.source },
					outDir: looseOutDir,
					format: [lf.format],
					platform: "node",
					sourcemap: !isProdGroup,
					minify: isProdGroup && (options.minify ?? false),
					// Bundle the whole module graph into the single literal output file.
					unbundle: false,
					clean: false,
					fixedExtension: lf.fixedExtension,
					dts: false,
					define: {
						"process.env.__PACKAGE_VERSION__": JSON.stringify(options.version),
						...options.define,
					},
					...instrument(group.id),
					...(Object.keys(looseDeps).length > 0 ? { deps: looseDeps } : {}),
					...(hasCjs ? { cjsDefault: true } : {}),
					plugins: [
						...(hasCjs ? [nodeBuiltinDefaultInterop(), cjsDefaultInterop()] : []),
						...(options.extraPlugins ?? []),
						...metricsPlugins(group.id, "loose"),
					],
				}),
			);
		}
	}
}

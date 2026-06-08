// packages/tsdown-plugins/src/build/build-target-groups.ts
import { join } from "node:path";
import type { Plugin } from "rolldown";
import type { JsxConfig } from "../jsx/config.js";
import type { TargetGroupRef } from "../manifest/emit-manifest.js";
import { emitManifest } from "../manifest/emit-manifest.js";
import type { Json } from "../manifest/transform.js";
import { cjsDefaultInterop } from "./cjs-default-interop.js";
import { syncPublicDir } from "./sync-public.js";
import type { BuildFormat, BuildGroupSpec } from "./target-groups.js";
import { deriveDtsPassOptions, deriveTargetGroupOptions } from "./target-groups.js";

/** Signature compatible with tsdown's `build(inlineConfig)`. */
export type TsdownBuild = (config: Record<string, unknown>) => Promise<unknown>;

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
	/** Output formats to emit. Defaults to esm-only when unset. */
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
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
	/** Injectable for tests; defaults to tsdown's build. */
	readonly build?: TsdownBuild;
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

	for (const group of options.groups) {
		const deriveInput = {
			group: group.id,
			cwd: options.cwd,
			version: options.version,
			entry: options.entry,
			tsconfigPath: options.tsconfigPath,
			devManifest: options.devManifest,
			...(options.externals !== undefined ? { externals: options.externals } : {}),
			...(options.bundledPackages !== undefined ? { bundledPackages: options.bundledPackages } : {}),
			...(options.format !== undefined ? { format: options.format } : {}),
			...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
		};
		const js = deriveTargetGroupOptions(deriveInput);
		const dts = deriveDtsPassOptions(deriveInput);
		const targetGroup: TargetGroupRef = { id: group.id, name: group.name, isProd: js.isProd };
		const manifestPlugin = emitManifest({
			targetGroup,
			devManifest: options.devManifest,
			transform: options.transform,
			sourceDir: options.cwd,
			dual: js.format.includes("cjs"),
		});

		// Pass 1: per-module JS, no dts. Emits the manifest; public/ is mirrored separately below.
		await build({
			config: false,
			cwd: options.cwd,
			entry: js.entry,
			outDir: js.outDir,
			format: js.format,
			platform: js.platform,
			sourcemap: js.sourcemap,
			minify: js.minify,
			unbundle: js.unbundle,
			clean: js.clean,
			fixedExtension: js.fixedExtension,
			dts: js.dts,
			define: js.define,
			...(options.externals?.length || options.bundleNodeModules
				? {
						deps: {
							...(options.externals?.length ? { neverBundle: options.externals } : {}),
							// skipNodeModulesBundle: false force-bundles node_modules deps not in
							// neverBundle (rslib parity). JS pass only; tsdown forbids combining it
							// with deps.alwaysBundle, so this is the minimal correct knob.
							...(options.bundleNodeModules ? { skipNodeModulesBundle: false } : {}),
						},
					}
				: {}),
			...(js.cjsDefault !== undefined ? { cjsDefault: js.cjsDefault } : {}),
			...(js.jsx !== undefined ? { inputOptions: { jsx: js.jsx } } : {}),
			// The cjs-default-interop plugin is a no-op for esm; only attach it when cjs is built.
			// It promotes a default+named CJS ENTRY chunk to `module.exports = <default>` (rslib
			// cjsInterop parity), so `import(x).default` is the value, not the {default,...named}
			// wrapper rolldown's exports:"auto"/"named" emit for default+named modules.
			plugins: [
				manifestPlugin,
				...(js.format.includes("cjs") ? [cjsDefaultInterop()] : []),
				...(options.extraPlugins ?? []),
			],
		});

		// Mirror public/ into the group's pkg dir (idempotent; replaces tsdown's copy, which
		// EEXISTs on a pre-existing target). Pass 1 owns the outDir, so sync before the dts pass.
		syncPublicDir(publicDir, join(js.outDir, "public"));

		// dts-pass neverBundle = union of externals + dtsExternals (dts-pass-only externals).
		const dtsNeverBundle = [...(options.externals ?? []), ...(options.dtsExternals ?? [])];

		// Pass 2: bundled declarations only, appended to the same outDir. NO manifest, NO copy,
		// NO sourcemaps, and clean:false so it does not wipe the JS pass above.
		await build({
			config: false,
			cwd: options.cwd,
			entry: dts.entry,
			outDir: dts.outDir,
			format: dts.format,
			platform: dts.platform,
			sourcemap: dts.sourcemap,
			unbundle: dts.unbundle,
			clean: dts.clean,
			fixedExtension: dts.fixedExtension,
			dts: dts.dts,
			define: dts.define,
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
			...(dtsNeverBundle.length > 0 || options.bundleNodeModules || dts.bundledPackages
				? {
						deps: {
							...(dtsNeverBundle.length > 0 ? { neverBundle: dtsNeverBundle } : {}),
							...(options.bundleNodeModules
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
			// footer-less one (verified). Re-attach the interop plugin here so the footer lands on
			// the FINAL `.cjs`. The plugin is gated to cjs entry chunks with default+named exports,
			// so it is a no-op on the esm `.js`/`.d.ts` and on any pass that emits no such chunk.
			plugins: [...(dts.format.includes("cjs") ? [cjsDefaultInterop()] : []), ...(options.extraPlugins ?? [])],
		});
	}
}

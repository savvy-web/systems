// packages/tsdown-plugins/src/build/build-target-groups.ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "rolldown";
import type { JsxConfig } from "../jsx/config.js";
import type { TargetGroupRef } from "../manifest/emit-manifest.js";
import { emitManifest } from "../manifest/emit-manifest.js";
import type { Json } from "../manifest/transform.js";
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
	/** Output formats to emit. Defaults to esm-only when unset. */
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
	readonly transform?: (args: { pkg: Json; targetGroup: TargetGroupRef }) => Json;
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
	const copy = existsSync(join(options.cwd, "public")) ? ["public"] : undefined;

	for (const group of options.groups) {
		const deriveInput = {
			group: group.id,
			cwd: options.cwd,
			version: options.version,
			entry: options.entry,
			tsconfigPath: options.tsconfigPath,
			devManifest: options.devManifest,
			...(options.externals !== undefined ? { externals: options.externals } : {}),
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

		// Pass 1: per-module JS, no dts. Emits the manifest + copies public/ exactly once.
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
			...(options.externals ? { deps: { neverBundle: options.externals } } : {}),
			...(copy ? { copy } : {}),
			...(js.cjsDefault !== undefined ? { cjsDefault: js.cjsDefault } : {}),
			...(js.jsx !== undefined ? { inputOptions: { jsx: js.jsx } } : {}),
			plugins: [manifestPlugin, ...(options.extraPlugins ?? [])],
		});

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
			...(options.externals ? { deps: { neverBundle: options.externals } } : {}),
			...(dts.jsx !== undefined ? { inputOptions: { jsx: dts.jsx } } : {}),
			plugins: [...(options.extraPlugins ?? [])],
		});
	}
}

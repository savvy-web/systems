// packages/tsdown-plugins/src/build/build-target-groups.ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "rolldown";
import type { JsxConfig } from "../jsx/config.js";
import type { TargetGroupRef } from "../manifest/emit-manifest.js";
import { emitManifest } from "../manifest/emit-manifest.js";
import type { Json } from "../manifest/transform.js";
import type { BuildFormat, BuildGroupSpec } from "./target-groups.js";
import { deriveTargetGroupOptions } from "./target-groups.js";

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

/** Run tsdown.build() once per TargetGroup. Composable so the escape hatch gets multi-group too. */
export async function buildTargetGroups(options: BuildTargetGroupsOptions): Promise<void> {
	const build: TsdownBuild = options.build ?? ((await import("tsdown")).build as unknown as TsdownBuild);
	const copy = existsSync(join(options.cwd, "public")) ? ["public"] : undefined;

	for (const group of options.groups) {
		const derived = deriveTargetGroupOptions({
			group: group.id,
			cwd: options.cwd,
			version: options.version,
			entry: options.entry,
			tsconfigPath: options.tsconfigPath,
			devManifest: options.devManifest,
			...(options.externals !== undefined ? { externals: options.externals } : {}),
			...(options.format !== undefined ? { format: options.format } : {}),
			...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
		});
		const targetGroup: TargetGroupRef = { id: group.id, name: group.name, isProd: derived.isProd };
		const manifestPlugin = emitManifest({
			targetGroup,
			devManifest: options.devManifest,
			transform: options.transform,
			sourceDir: options.cwd,
			dual: derived.format.includes("cjs"),
		});
		await build({
			config: false,
			cwd: options.cwd,
			entry: derived.entry,
			outDir: derived.outDir,
			format: derived.format,
			platform: derived.platform,
			sourcemap: derived.sourcemap,
			minify: derived.minify,
			unbundle: derived.unbundle,
			fixedExtension: derived.fixedExtension,
			dts: derived.dts,
			define: derived.define,
			...(options.externals ? { deps: { neverBundle: options.externals } } : {}),
			...(copy ? { copy } : {}),
			...(derived.cjsDefault !== undefined ? { cjsDefault: derived.cjsDefault } : {}),
			...(derived.jsx !== undefined ? { inputOptions: { jsx: derived.jsx } } : {}),
			plugins: [manifestPlugin, ...(options.extraPlugins ?? [])],
		});
	}
}

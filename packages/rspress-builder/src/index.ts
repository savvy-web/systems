// packages/rspress-builder/src/index.ts
import { dirname } from "node:path";
import type { BuildConfig, BuildConfigInput, BuildEntryOverride, RunOptions } from "@savvy-web/bundler";
import { defineBuild, runBuild } from "@savvy-web/bundler";

export type { RunOptions };
// Re-export the orchestrator so a consumer imports both from one source. definePlugin
// returns a standard BuildConfig with the runtime baked in as an override partition, so the
// bundler's runBuild consumes it unchanged.
export { runBuild };

/**
 * Per-bundle externals tuning for a single partition (plugin or runtime).
 *
 * @public
 */
export interface RspressBundleOptions {
	/** Additional externals merged with the built-ins for that bundle. */
	readonly externals?: ReadonlyArray<string>;
}

/**
 * Options for `definePlugin`. Deliberately small — RSPress plugins have a fixed shape.
 *
 * @public
 */
export interface RspressPluginOptions {
	/**
	 * Enable the `./runtime` bundle (browser, bundleless, CSS modules, React/`@theme` external).
	 * `true` (default) builds it; `false` disables it; an object tunes its externals.
	 * This does not auto-detect the filesystem — pass `false` for a plugin with no runtime.
	 */
	readonly runtime?: boolean | RspressBundleOptions;
	/** Tuning for the plugin (`.`) bundle (node, bundled). */
	readonly plugin?: RspressBundleOptions;
	/** Packages whose declarations are inlined into the bundled dts (e.g. [`@rspress/core`]). */
	readonly dtsBundledPackages?: ReadonlyArray<string>;
	/** API-model generation. Defaults to on (documents plugin options AND runtime components). `false` opts out. */
	readonly apiModel?: BuildConfigInput["meta"];
	/** Final package.json mutation; defaults to the bundler's defaultManifestTransform. */
	readonly transform?: BuildConfigInput["transform"];
	/** JSX override; defaults to tsconfig-inferred. */
	readonly jsx?: BuildConfigInput["jsx"];
	/**
	 * Build-wide compile-time global replacements forwarded to every partition (the bundler's
	 * `define` is build-wide; there is no per-bundle define). Merged AFTER the `import.meta.env`
	 * identity map, so a user key may override it intentionally. Values are inserted verbatim
	 * (string literals must be quoted).
	 */
	readonly define?: Record<string, string>;
}

/** Built-in externals for the plugin (node) bundle. */
const PLUGIN_EXTERNALS = ["@rspress/core"] as const;
/** Built-in externals for the runtime (browser) bundle — provided by RSPress at site build time. */
const RUNTIME_EXTERNALS = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "@rspress/core", "@theme"] as const;

/**
 * Build an RSPress plugin package: a Node plugin entry (`.`) plus a browser, bundleless,
 * CSS-module React runtime entry (`./runtime`). Returns a standard `BuildConfig`;
 * hand it to `runBuild` from a self-executing `savvy.build.ts`.
 *
 * @public
 */
export function definePlugin(options: RspressPluginOptions = {}): BuildConfig {
	const runtimeOpt = options.runtime ?? true;
	const runtimeEnabled = runtimeOpt !== false;
	const runtimeTuning: RspressBundleOptions = typeof runtimeOpt === "object" ? runtimeOpt : {};
	const pluginTuning = options.plugin ?? {};

	const pluginExternals = [...PLUGIN_EXTERNALS, ...(pluginTuning.externals ?? [])];

	const overrides: BuildEntryOverride[] = runtimeEnabled
		? [
				{
					entries: ["./runtime"],
					outSubdir: "runtime",
					platform: "browser",
					css: { modules: { localsConvention: "camelCaseOnly", namedExport: false }, inject: true },
					externals: [...RUNTIME_EXTERNALS, ...(runtimeTuning.externals ?? [])],
				},
			]
		: [];

	// The identity map preserves `import.meta.env` (notably SSG_MD) for RSPress to resolve per site.
	const define: Record<string, string> = {
		"import.meta.env": "import.meta.env",
		...options.define,
	};

	const input: BuildConfigInput = {
		externals: pluginExternals,
		define,
		...(options.dtsBundledPackages !== undefined ? { bundledPackages: options.dtsBundledPackages } : {}),
		...(options.apiModel !== undefined ? { meta: options.apiModel } : {}),
		...(options.transform !== undefined ? { transform: options.transform } : {}),
		...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
		...(overrides.length > 0 ? { overrides } : {}),
	};

	return defineBuild(input);
}

/**
 * Front door for building an RSPress plugin. Applies the {@link definePlugin} preset
 * and runs the build, deriving `cwd` and `argv` from `process.argv`. For advanced use,
 * {@link definePlugin} and {@link runBuild} remain exported.
 *
 * @public
 */
export async function build(options: RspressPluginOptions = {}, overrides: Partial<RunOptions> = {}): Promise<void> {
	return runBuild(definePlugin(options), {
		cwd: dirname(process.argv[1] ?? process.cwd()),
		argv: process.argv.slice(2),
		...overrides,
	});
}

// packages/rspress-builder/src/index.ts
import { dirname } from "node:path";
import type { BuildConfig, BuildConfigInput, BuildEntryOverride, RunOptions } from "@savvy-web/bundler";
import { defineBuild, runBuild } from "@savvy-web/bundler";

export type { BuildConfig, BuildConfigInput, BuildEntryOverride, RunOptions };

// Re-export the orchestrator so a consumer imports both from one source. definePlugin
// returns a standard BuildConfig with the runtime baked in as an override partition, so the
// bundler's runBuild consumes it unchanged.
export { runBuild };

/**
 * Per-bundle dependency posture for a single partition (plugin or runtime). Mirrors the
 * bundler's `BuildEntryOverride`; a value set here wins over the build-wide option of the
 * same name.
 *
 * @public
 */
export interface RspressBundleOptions {
	/** Additional externals merged with this bundle's built-ins and the build-wide `externals`. */
	readonly externals?: ReadonlyArray<string>;
	/** Packages whose declarations are inlined into this bundle's dts. */
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
	/** Packages externalized in this bundle's dts pass only, referenced via import in the emitted `.d.ts`. */
	readonly dtsExternals?: ReadonlyArray<string> | undefined;
	/** Force-bundle node_modules JS dependencies into this bundle's output. */
	readonly bundleNodeModules?: boolean | undefined;
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
	/** Build-wide externals merged into BOTH bundles' built-in lists. */
	readonly externals?: ReadonlyArray<string>;
	/** Packages whose declarations are inlined into the bundled dts (e.g. [`@rspress/core`]). */
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
	/**
	 * Packages externalized in the dts pass ONLY — referenced via `import` in the emitted
	 * `.d.ts` rather than inlined — while the JS pass still bundles them. Declare these as
	 * package dependencies so consumers can resolve the emitted type imports.
	 */
	readonly dtsExternals?: ReadonlyArray<string> | undefined;
	/** Force-bundle node_modules (and workspace) JS dependencies into the package output. */
	readonly bundleNodeModules?: boolean | undefined;
	/** API-model generation. Defaults to on (documents plugin options AND runtime components). `false` opts out. */
	readonly meta?: BuildConfigInput["meta"];
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

	const dedupe = (xs: ReadonlyArray<string>): string[] => [...new Set(xs)];
	const sharedExternals = options.externals ?? [];

	const pluginExternals = dedupe([...PLUGIN_EXTERNALS, ...sharedExternals, ...(pluginTuning.externals ?? [])]);

	const overrides: BuildEntryOverride[] = runtimeEnabled
		? [
				{
					entries: ["./runtime"],
					outSubdir: "runtime",
					platform: "browser",
					css: { modules: { localsConvention: "camelCaseOnly", namedExport: false }, inject: true },
					externals: dedupe([...RUNTIME_EXTERNALS, ...sharedExternals, ...(runtimeTuning.externals ?? [])]),
					// The bundler builds each override partition from its own values only — it does
					// NOT fall back to the base build's value for an omitted option (see EntryOverride
					// in build-target-groups.ts). So the build-wide value has to be threaded through
					// here explicitly, with the per-bundle tuning winning when both are set.
					...((runtimeTuning.bundledPackages ?? options.bundledPackages) !== undefined
						? { bundledPackages: runtimeTuning.bundledPackages ?? options.bundledPackages }
						: {}),
					...((runtimeTuning.dtsExternals ?? options.dtsExternals) !== undefined
						? { dtsExternals: runtimeTuning.dtsExternals ?? options.dtsExternals }
						: {}),
					...((runtimeTuning.bundleNodeModules ?? options.bundleNodeModules) !== undefined
						? { bundleNodeModules: runtimeTuning.bundleNodeModules ?? options.bundleNodeModules }
						: {}),
				},
			]
		: [];

	// The identity map preserves `import.meta.env` (notably SSG_MD) for RSPress to resolve per site.
	const define: Record<string, string> = {
		"import.meta.env": "import.meta.env",
		...options.define,
	};

	// The plugin (".") bundle IS the base build, so plugin tuning resolves against the
	// build-wide value here rather than through an override.
	const bundledPackages = pluginTuning.bundledPackages ?? options.bundledPackages;
	const dtsExternals = pluginTuning.dtsExternals ?? options.dtsExternals;
	const bundleNodeModules = pluginTuning.bundleNodeModules ?? options.bundleNodeModules;

	const input: BuildConfigInput = {
		externals: pluginExternals,
		define,
		...(bundledPackages !== undefined ? { bundledPackages } : {}),
		...(dtsExternals !== undefined ? { dtsExternals } : {}),
		...(bundleNodeModules !== undefined ? { bundleNodeModules } : {}),
		...(options.meta !== undefined ? { meta: options.meta } : {}),
		...(options.transform !== undefined ? { transform: options.transform } : {}),
		...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
		...(overrides.length > 0 ? { overrides } : {}),
	};

	return defineBuild(input);
}

/**
 * Front door for building an RSPress plugin. Applies the {@link definePlugin} preset
 * and runs the build, deriving `cwd` and `argv` from `process.argv`. For advanced use,
 * {@link definePlugin} and `runBuild` remain exported.
 *
 * @public
 */
export async function build(options: RspressPluginOptions = {}, overrides: Partial<RunOptions> = {}): Promise<void> {
	return runBuild(definePlugin(options), {
		cwd: process.argv[1] ? dirname(process.argv[1]) : process.cwd(),
		argv: process.argv.slice(2),
		...overrides,
	});
}

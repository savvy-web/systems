// packages/bundler/src/config.ts
import type {
	BuildFormat,
	BuildPlatform,
	CssOptions,
	ExeConfig,
	Json,
	JsxConfig,
	LooseFiles,
	MetaOptions,
	TargetGroupRef,
} from "@savvy-web/tsdown-plugins";
import { defaultManifestTransform } from "@savvy-web/tsdown-plugins";

export interface BuildEntryOverride {
	/** Export paths to pin to this partition, e.g. "./changesets/markdownlint" (or "." for root). */
	readonly entries: ReadonlyArray<string>;
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
	readonly bundle?: ReadonlyArray<string> | undefined;
	readonly externals?: ReadonlyArray<string> | undefined;
	readonly bundleNodeModules?: boolean | undefined;
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
	readonly dtsExternals?: ReadonlyArray<string> | undefined;
	/** JS-pass platform for this partition (default "node"). Use "browser" for an RSPress runtime. */
	readonly platform?: BuildPlatform | undefined;
	/** CSS handling forwarded to tsdown's `css` option (JS pass only). Enables `@tsdown/css`. */
	readonly css?: CssOptions | undefined;
	/**
	 * Build this entry's partition into a `<group>/pkg/<outSubdir>/` subdir as an isolated sub-package
	 * (e.g. an RSPress `./runtime`). The export's built path becomes `./<outSubdir>/index.{js,d.ts}`.
	 * Exactly ONE export path may be pinned per `outSubdir` override.
	 */
	readonly outSubdir?: string | undefined;
}

export interface OutputConfig {
	readonly console?: { readonly human?: boolean; readonly agent?: boolean; readonly ci?: boolean };
	readonly format?: "terminal" | "json" | "markdown" | "ci-annotations" | "silent";
}

export interface BuildConfigInput {
	readonly formats?: ReadonlyArray<"esm">;
	readonly externals?: ReadonlyArray<string>;
	/**
	 * External packages whose type declarations are inlined into the bundled dts
	 * (the rslib `dtsBundledPackages` equivalent). Only these node_modules
	 * packages are rolled into the emitted `.d.ts`; all other deps stay external.
	 */
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
	/**
	 * Packages externalized in the dts pass ONLY — referenced via `import` in the
	 * emitted `.d.ts` rather than inlined — while the JS pass still bundles them per
	 * `bundleNodeModules`. Use when a dependency's types cannot be safely inlined,
	 * for example effect's cross-module `declare module` augmentations, which inline
	 * into conflicting interface-extension errors in consumers. Declare these as
	 * package dependencies so consumers can resolve the emitted type imports.
	 */
	readonly dtsExternals?: ReadonlyArray<string> | undefined;
	/**
	 * Force-bundle node_modules (and workspace) JS dependencies that are not
	 * externalized into the package output, restoring the self-contained bundle
	 * the rslib builder produced. Threads tsdown `deps.skipNodeModulesBundle:
	 * false` into BOTH the JS output and the bundled declarations: the dts posture
	 * tracks the JS posture, so node_modules types are inlined into the `.d.ts`
	 * and the published package needs no extra declared deps for them. Defaults to false.
	 */
	readonly bundleNodeModules?: boolean | undefined;
	/**
	 * Force-bundle (inline) these packages into the JS output, even ones declared in
	 * package.json that would otherwise be auto-externalized. The inverse of `externals`;
	 * maps to tsdown `deps.alwaysBundle`. Accepts package names. Use when you declare a
	 * dependency for metadata/types but want its code inlined. Declarations are NOT
	 * inlined by this option — use `bundledPackages` to also roll a package's types into
	 * the emitted `.d.ts`.
	 */
	readonly bundle?: ReadonlyArray<string> | undefined;
	/**
	 * Minify the prod build output. Applies ONLY to prod target groups (dev is never
	 * minified) and defaults to false: this builder targets Node libraries, where
	 * readable output matters more than bundle size — minified/obfuscated code trips
	 * security/SCA scanners and degrades stack traces. Set true to opt back in.
	 */
	readonly minify?: boolean | undefined;
	readonly devManifest?: "preserve" | "resolve";
	/**
	 * Final mutation of the emitted package.json, run after the declarative
	 * `publishConfig.targets` rename. Defaults to {@link defaultManifestTransform},
	 * which strips build/dev-only fields (devDependencies, scripts, publishConfig,
	 * etc.). Supplying your own REPLACES that default — import and call
	 * `defaultManifestTransform` from it if you still want the stripping.
	 */
	readonly transform?: (args: { pkg: Json; targetGroup: TargetGroupRef }) => Json;
	readonly output?: OutputConfig;
	/**
	 * API-model (meta) generation. Tri-state: omit it (or `undefined`) to generate with DEFAULT
	 * options; `--target prod` emits the meta release asset for every prod group and copies the
	 * canonical group's bundle into `localPaths`. Pass an object to override defaults (`localPaths`,
	 * `tsdoc`, `optimistic`). Pass `false` to opt OUT (the prod meta asset becomes a no-op).
	 * NOTE: `--target meta` is deprecated and now a no-op; meta is a function of `--target prod`.
	 */
	readonly meta?: MetaOptions | false;
	readonly jsx?: JsxConfig | undefined;
	readonly exe?: ExeConfig | ReadonlyArray<ExeConfig> | undefined;
	/**
	 * Output module formats forwarded to the tsdown build. Defaults to esm-only;
	 * add "cjs" for a dual-format esm plus cjs build. This is the live field;
	 * the legacy "formats" field above is not consumed by the build.
	 */
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
	/**
	 * Per-entry format/bundling overrides. Each group pins its `entries` (export paths) to
	 * its own format and bundling, layered onto the base build. Use to keep one entry CJS in
	 * an otherwise ESM-only package (e.g. silk's `./changesets/markdownlint`).
	 */
	readonly overrides?: ReadonlyArray<BuildEntryOverride> | undefined;
	/**
	 * Standalone bundled output files emitted at literal paths (e.g. pnpm config-dependency
	 * pnpmfiles), outside the exports/dts/meta graph. Keys are literal output filenames; values
	 * are a source path (bare string) or `{ source, format }`. Format is inferred from a
	 * `.mjs`/`.cjs` key and required for an ambiguous `.js` key. Pair with `bundleNodeModules`
	 * to make each file self-contained.
	 */
	readonly looseFiles?: LooseFiles | undefined;
	/**
	 * Compile-time global replacements forwarded to the tsdown/rolldown build `define`.
	 * Values are inserted VERBATIM, so string literals must be quoted:
	 * `{ "process.env.FLAG": JSON.stringify("on") }`. Merged with the auto-injected
	 * `process.env.__PACKAGE_VERSION__` define; a user key of the same name wins.
	 */
	readonly define?: Record<string, string> | undefined;
}

export interface BuildConfig {
	readonly formats: ReadonlyArray<"esm">;
	readonly externals: ReadonlyArray<string>;
	/**
	 * External packages whose type declarations are inlined into the bundled dts
	 * (the rslib `dtsBundledPackages` equivalent). Only these node_modules
	 * packages are rolled into the emitted `.d.ts`; all other deps stay external.
	 */
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
	/**
	 * Packages externalized in the dts pass ONLY — referenced via `import` in the
	 * emitted `.d.ts` rather than inlined — while the JS pass still bundles them per
	 * `bundleNodeModules`. Use when a dependency's types cannot be safely inlined
	 * (e.g. effect's cross-module `declare module` augmentations). Declare these as
	 * package dependencies so consumers can resolve the emitted type imports.
	 */
	readonly dtsExternals?: ReadonlyArray<string> | undefined;
	/**
	 * Force-bundle node_modules (and workspace) JS dependencies that are not
	 * externalized into the package output (rslib parity). Threads tsdown
	 * `deps.skipNodeModulesBundle: false` into BOTH the JS output and the bundled
	 * declarations — the dts posture tracks the JS posture, inlining node_modules
	 * types into the `.d.ts`. Defaults to false.
	 */
	readonly bundleNodeModules?: boolean | undefined;
	/** Force-bundle (inline) these packages into the JS output (tsdown `deps.alwaysBundle`). Inverse of `externals`. */
	readonly bundle?: ReadonlyArray<string> | undefined;
	/** Minify prod output (prod groups only; dev is never minified). defineBuild defaults this to false. */
	readonly minify?: boolean | undefined;
	readonly devManifest: "preserve" | "resolve";
	readonly transform?: ((args: { pkg: Json; targetGroup: TargetGroupRef }) => Json) | undefined;
	readonly output?: OutputConfig | undefined;
	readonly meta?: MetaOptions | false | undefined;
	readonly jsx?: JsxConfig | undefined;
	readonly exe?: ExeConfig | ReadonlyArray<ExeConfig> | undefined;
	/** Output module formats forwarded to the tsdown build (esm-only by default; add "cjs" for dual-format). */
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
	readonly overrides?: ReadonlyArray<BuildEntryOverride> | undefined;
	/** Standalone bundled output files emitted at literal paths, outside the exports/dts/meta graph. */
	readonly looseFiles?: LooseFiles | undefined;
	/** Compile-time global replacements forwarded to the build `define` (merged with the auto-version). */
	readonly define?: Record<string, string> | undefined;
}

/** Normalize + validate a defineBuild config. Pure when imported; self-runs when entry (see run.ts). */
export function defineBuild(input: BuildConfigInput = {}): BuildConfig {
	const config: BuildConfig = {
		formats: input.formats ?? ["esm"],
		externals: input.externals ?? [],
		bundledPackages: input.bundledPackages,
		dtsExternals: input.dtsExternals,
		bundleNodeModules: input.bundleNodeModules,
		bundle: input.bundle,
		minify: input.minify ?? false,
		devManifest: input.devManifest ?? "preserve",
		// Default to stripping build/dev-only manifest fields (the pattern nearly every
		// package repeated by hand). A package supplies its own transform only for genuinely
		// custom manifest work; doing so REPLACES this default (re-export and call
		// defaultManifestTransform to keep the stripping). See @savvy-web/tsdown-plugins.
		transform: input.transform ?? defaultManifestTransform,
		output: input.output,
		meta: input.meta,
		jsx: input.jsx,
		exe: input.exe,
		format: input.format,
		overrides: input.overrides,
		looseFiles: input.looseFiles,
		define: input.define,
	};
	// Self-execution: only when this module's importer is the program entry.
	// run.ts performs the actual import.meta.main gate (it has access to the caller's meta).
	return config;
}

export interface ParsedArgs {
	readonly target: "dev" | "prod" | "meta" | "exe";
	readonly watch: boolean;
	/** Skip the SEA compile step of a dev/prod build (the manifest is still programmed). Used by `prepare`. */
	readonly noExe: boolean;
	readonly verbose: boolean;
}

export function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
	let target: "dev" | "prod" | "meta" | "exe" = "dev";
	let watch = false;
	let noExe = false;
	let verbose = false;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--target") {
			const v = argv[i + 1];
			if (v === "dev" || v === "prod" || v === "meta" || v === "exe") target = v;
			i++;
		} else if (argv[i] === "--watch") {
			watch = true;
		} else if (argv[i] === "--no-exe") {
			noExe = true;
		} else if (argv[i] === "--verbose") {
			verbose = true;
		}
	}
	return { target, watch, noExe, verbose };
}

export type {
	BuildFormat,
	ExeConfig,
	ExeTarget,
	JsxConfig,
	LooseFileSpec,
	LooseFiles,
	MetaOptions,
	NormalizedExe,
	PublishTargetValue,
	PublishTargets,
	ResolvedGroup,
	ResolvedTarget,
	TargetResolution,
} from "@savvy-web/tsdown-plugins";

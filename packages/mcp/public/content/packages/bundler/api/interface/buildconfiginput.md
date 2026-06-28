---
id: packages/bundler/api/interface/buildconfiginput
title: "BuildConfigInput — bundler interface"
summary: "interface BuildConfigInput from @savvy-web/bundler."
tier: packages
source: generated
tags: [bundler, api]
priority: 0.3
related: []
---

# BuildConfigInput

```ts
interface BuildConfigInput
```

## Members

### bundle

```ts
readonly bundle?: ReadonlyArray<string> | undefined;
```

Force-bundle (inline) these packages into the JS output, even ones declared in package.json that would otherwise be auto-externalized. The inverse of `externals`; maps to tsdown `deps.alwaysBundle`. Accepts package names. Use when you declare a dependency for metadata/types but want its code inlined. Declarations are NOT inlined by this option — use `bundledPackages` to also roll a package's types into the emitted `.d.ts`.

### bundledPackages

```ts
readonly bundledPackages?: ReadonlyArray<string> | undefined;
```

External packages whose type declarations are inlined into the bundled dts (the rslib `dtsBundledPackages` equivalent). Only these node_modules packages are rolled into the emitted `.d.ts`; all other deps stay external.

### bundleNodeModules

```ts
readonly bundleNodeModules?: boolean | undefined;
```

Force-bundle node_modules (and workspace) JS dependencies that are not externalized into the package output, restoring the self-contained bundle the rslib builder produced. Threads tsdown `deps.skipNodeModulesBundle: false` into BOTH the JS output and the bundled declarations: the dts posture tracks the JS posture, so node_modules types are inlined into the `.d.ts` and the published package needs no extra declared deps for them. Defaults to false.

### define

```ts
readonly define?: Record<string, string> | undefined;
```

Compile-time global replacements forwarded to the tsdown/rolldown [build](silk://packages/bundler/api/function/build) `define`. Values are inserted VERBATIM, so string literals must be quoted: `{ "process.env.FLAG": JSON.stringify("on") }`. Merged with the auto-injected `process.env.__PACKAGE_VERSION__` define; a user key of the same name wins.

### devManifest

```ts
readonly devManifest?: "preserve" | "resolve";
```

### dtsExternals

```ts
readonly dtsExternals?: ReadonlyArray<string> | undefined;
```

Packages externalized in the dts pass ONLY — referenced via `import` in the emitted `.d.ts` rather than inlined — while the JS pass still bundles them per `bundleNodeModules`. Use when a dependency's types cannot be safely inlined, for example effect's cross-module `declare module` augmentations, which inline into conflicting interface-extension errors in consumers. Declare these as package dependencies so consumers can resolve the emitted type imports.

### exe

```ts
readonly exe?: ExeConfig | ReadonlyArray<ExeConfig> | undefined;
```

### externals

```ts
readonly externals?: ReadonlyArray<string>;
```

### format

```ts
readonly format?: ReadonlyArray<BuildFormat> | undefined;
```

Output module formats forwarded to the tsdown [build](silk://packages/bundler/api/function/build). Defaults to esm-only; add "cjs" for a dual-format esm plus cjs [build](silk://packages/bundler/api/function/build). This is the live field; the legacy "formats" field above is not consumed by the [build](silk://packages/bundler/api/function/build).

### formats

```ts
readonly formats?: ReadonlyArray<"esm">;
```

### jsx

```ts
readonly jsx?: JsxConfig | undefined;
```

### looseFiles

```ts
readonly looseFiles?: LooseFiles | undefined;
```

Standalone bundled output files emitted at literal paths (e.g. pnpm config-dependency pnpmfiles), outside the exports/dts/meta graph. Keys are literal output filenames; values are a source path (bare string) or `{ source, format }`. Format is inferred from a `.mjs`/`.cjs` key and required for an ambiguous `.js` key. Pair with `bundleNodeModules` to make each file self-contained.

### meta

```ts
readonly meta?: MetaOptions | false;
```

API-model (meta) generation. Tri-state: omit it (or `undefined`) to generate with DEFAULT options; `--target prod` emits the meta release asset for every prod group and copies the canonical group's bundle into `localPaths`. Pass an object to override defaults (`localPaths`, `tsdoc`, `optimistic`). Pass `false` to opt OUT (the prod meta asset becomes a no-op). NOTE: `--target meta` is deprecated and now a no-op; meta is a function of `--target prod`.

### minify

```ts
readonly minify?: boolean | undefined;
```

Minify the prod [build](silk://packages/bundler/api/function/build) output. Applies ONLY to prod target groups (dev is never minified) and defaults to false: this builder targets Node libraries, where readable output matters more than bundle size — minified/obfuscated code trips security/SCA scanners and degrades stack traces. Set true to opt back in.

### output

```ts
readonly output?: OutputConfig;
```

### overrides

```ts
readonly overrides?: ReadonlyArray<BuildEntryOverride> | undefined;
```

Per-entry format/bundling overrides. Each group pins its `entries` (export paths) to its own format and bundling, layered onto the base [build](silk://packages/bundler/api/function/build). Use to keep one entry CJS in an otherwise ESM-only package (e.g. silk's `./changesets/markdownlint`).

### plugins

```ts
readonly plugins?: ReadonlyArray<Plugin$1> | undefined;
```

Custom tsdown/rolldown plugins forwarded to EVERY tsdown run the [build](silk://packages/bundler/api/function/build) performs — the JS pass, the dts pass, the per-module declarations pass, and each looseFiles pass. Use for [build](silk://packages/bundler/api/function/build)-time codegen / virtual modules (e.g. a pnpm config-dependency plugin). Plugins run after the builder's internal interop plugins and before its metrics instrumentation.

### transform

```ts
readonly transform?: (args: {
    pkg: Json;
    targetGroup: TargetGroupRef;
  }) => Json;
```

Final mutation of the emitted package.json, run after the declarative `publishConfig.targets` rename. Defaults to `defaultManifestTransform`, which strips [build](silk://packages/bundler/api/function/build)/dev-only fields (devDependencies, scripts, publishConfig, etc.). Supplying your own REPLACES that default — import and call `defaultManifestTransform` from it if you still want the stripping.

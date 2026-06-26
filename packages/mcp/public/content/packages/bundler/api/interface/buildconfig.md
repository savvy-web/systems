---
id: packages/bundler/api/interface/buildconfig
title: "BuildConfig — bundler interface"
summary: "interface BuildConfig from @savvy-web/bundler."
tier: packages
source: generated
tags: [bundler, api]
priority: 0.3
related: []
---

# BuildConfig

```ts
interface BuildConfig
```

## Members

### bundle

```ts
readonly bundle?: ReadonlyArray<string> | undefined;
```

Force-bundle (inline) these packages into the JS output (tsdown `deps.alwaysBundle`). Inverse of `externals`.

### bundledPackages

```ts
readonly bundledPackages?: ReadonlyArray<string> | undefined;
```

External packages whose type declarations are inlined into the bundled dts (the rslib `dtsBundledPackages` equivalent). Only these node_modules packages are rolled into the emitted `.d.ts`; all other deps stay external.

### bundleNodeModules

```ts
readonly bundleNodeModules?: boolean | undefined;
```

Force-bundle node_modules (and workspace) JS dependencies that are not externalized into the package output (rslib parity). Threads tsdown `deps.skipNodeModulesBundle: false` into BOTH the JS output and the bundled declarations — the dts posture tracks the JS posture, inlining node_modules types into the `.d.ts`. Defaults to false.

### define

```ts
readonly define?: Record<string, string> | undefined;
```

Compile-time global replacements forwarded to the build `define` (merged with the auto-version).

### devManifest

```ts
readonly devManifest: "preserve" | "resolve";
```

### dtsExternals

```ts
readonly dtsExternals?: ReadonlyArray<string> | undefined;
```

Packages externalized in the dts pass ONLY — referenced via `import` in the emitted `.d.ts` rather than inlined — while the JS pass still bundles them per `bundleNodeModules`. Use when a dependency's types cannot be safely inlined (e.g. effect's cross-module `declare module` augmentations). Declare these as package dependencies so consumers can resolve the emitted type imports.

### exe

```ts
readonly exe?: ExeConfig | ReadonlyArray<ExeConfig> | undefined;
```

### externals

```ts
readonly externals: ReadonlyArray<string>;
```

### format

```ts
readonly format?: ReadonlyArray<BuildFormat> | undefined;
```

Output module formats forwarded to the tsdown build (esm-only by default; add "cjs" for dual-format).

### formats

```ts
readonly formats: ReadonlyArray<"esm">;
```

### jsx

```ts
readonly jsx?: JsxConfig | undefined;
```

### looseFiles

```ts
readonly looseFiles?: LooseFiles | undefined;
```

Standalone bundled output files emitted at literal paths, outside the exports/dts/meta graph.

### meta

```ts
readonly meta?: MetaOptions | false | undefined;
```

### minify

```ts
readonly minify?: boolean | undefined;
```

Minify prod output (prod groups only; dev is never minified). [defineBuild](silk://packages/bundler/api/function/definebuild) defaults this to false.

### output

```ts
readonly output?: OutputConfig | undefined;
```

### overrides

```ts
readonly overrides?: ReadonlyArray<BuildEntryOverride> | undefined;
```

### plugins

```ts
readonly plugins?: ReadonlyArray<Plugin$1> | undefined;
```

Custom tsdown/rolldown plugins forwarded to every tsdown run (JS, dts, per-module declarations, looseFiles).

### transform

```ts
readonly transform?: ((args: {
    pkg: Json;
    targetGroup: TargetGroupRef;
  }) => Json) | undefined;
```

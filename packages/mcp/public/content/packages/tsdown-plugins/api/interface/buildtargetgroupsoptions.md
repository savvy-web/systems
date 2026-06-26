---
id: packages/tsdown-plugins/api/interface/buildtargetgroupsoptions
title: "BuildTargetGroupsOptions — tsdown-plugins interface"
summary: "interface BuildTargetGroupsOptions from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# BuildTargetGroupsOptions

```ts
interface BuildTargetGroupsOptions
```

## Members

### build

```ts
readonly build?: TsdownBuild;
```

Injectable for tests; defaults to tsdown's build.

### bundle

```ts
readonly bundle?: ReadonlyArray<string> | undefined;
```

Force-bundle (inline) these packages into the JS output (tsdown `deps.alwaysBundle`), even declared deps that would otherwise be auto-externalized. The inverse of `externals`. JS pass only; `alwaysBundle` is allowed alongside our `skipNodeModulesBundle: false` (the throw only fires when skipNodeModulesBundle is true).

### bundledPackages

```ts
readonly bundledPackages?: ReadonlyArray<string> | undefined;
```

External packages whose declarations are inlined into the bundled dts (rslib `dtsBundledPackages` equivalent). Forwarded to the dts pass as `deps.dts.alwaysBundle` alongside `skipNodeModulesBundle: true`; unlike `deps.onlyBundle` this does not enable tsdown's strict-mode check that errors on every unlisted transitive dependency. The JS pass is unaffected.

### bundleNodeModules

```ts
readonly bundleNodeModules?: boolean | undefined;
```

Force-bundle node_modules (and workspace) JS dependencies that are not externalized, restoring the rslib bundle-everything-except-externals behavior. Sets tsdown `deps.skipNodeModulesBundle: false`; the dts pass posture mirrors the JS pass, so the bundled declarations are also self-contained. Defaults to false (current behavior).

### collector

```ts
readonly collector?: BuildCollector | undefined;
```

When set, muzzle tsdown (silent + customLogger) and capture metrics/timing into this collector.

### cwd

```ts
readonly cwd: string;
```

### define

```ts
readonly define?: Record<string, string> | undefined;
```

Compile-time global replacements forwarded to BOTH the JS and dts passes' `define`. Build-wide (shared by every entry partition); merged after the auto-injected `process.env.__PACKAGE_VERSION__` so a user key of the same name wins.

### devManifest

```ts
readonly devManifest: "preserve" | "resolve";
```

### dtsExternals

```ts
readonly dtsExternals?: ReadonlyArray<string> | undefined;
```

Packages externalized in the dts pass ONLY — emitted as `import ... from "..."` references in the `.d.ts` rather than inlined — while the JS pass still bundles them per `bundleNodeModules`. The dts pass `neverBundle` becomes the union of `externals` and `dtsExternals`. Use when a dependency's types cannot be safely inlined into a single bundled declaration file (e.g. effect's cross-module `declare module` augmentations, which inline into conflicting interface extensions in consumers). The JS pass is unaffected.

### dualExports

```ts
readonly dualExports?: DualExports | undefined;
```

Which export keys get a CJS `require` condition in the emitted manifest. Pass a Set when overrides give different entries different formats; omit for the uniform `format`-includes-cjs behavior.

### emitDeclarations

```ts
readonly emitDeclarations?: boolean | undefined;
```

Emit a per-module (`unbundle: true`) declaration tree into `dist/prod/<id>/declarations/` per group, in addition to the bundled dts in `pkg/`. API Extractor's diagnostics-run input for the meta pass. Prod-only; the bundler sets it for `--target prod`. Absent → no third pass (byte-identical to the two-pass default). Not captured by the collector.

### entry

```ts
readonly entry: Record<string, string>;
```

### exeRewrite

```ts
readonly exeRewrite?: ExeRewrite | undefined;
```

When set, rewrite the emitted manifest's exports/bin values equal to the exe source to the SEA path and add it to `files`.

### externals

```ts
readonly externals?: ReadonlyArray<string>;
```

### extraPlugins

```ts
readonly extraPlugins?: ReadonlyArray<Plugin>;
```

Extra rolldown plugins, forwarded to BOTH the JS pass and the dts-only pass. A plugin with JS-lifecycle side effects (asset emitters, banner injectors) runs in both passes; the dts pass uses `emitDtsOnly`, so for esm-only builds it produces no JS chunks and most rolldown hooks are no-ops there. For DUAL (esm+cjs) builds, however, tsdown's dts pass still RE-EMITS the `.cjs` JS chunk and overwrites the JS pass's `.cjs` output — so a `renderChunk`/`generateBundle` plugin that must persist onto the final `.cjs` (e.g. the built-in cjs-default-interop) has to run in the dts pass too. A caller relying on a hook firing exactly once should guard the second invocation.

### format

```ts
readonly format?: ReadonlyArray<BuildFormat> | undefined;
```

Output formats to emit. Defaults to esm-only when unset.

### groups

```ts
readonly groups: ReadonlyArray<BuildGroupSpec>;
```

### looseFiles

```ts
readonly looseFiles?: ReadonlyArray<NormalizedLooseFile> | undefined;
```

Standalone bundled output files emitted at literal paths into each group's pkg/ dir, outside the exports/dts/meta graph (e.g. pnpm config-dependency pnpmfiles). Each runs as one extra single-entry, bundled (unbundle:false), no-dts, no-manifest pass per group, inheriting the group's bundleNodeModules/bundle/externals posture so the file is self-contained. Caller passes the normalized form (see [normalizeLooseFiles](silk://packages/tsdown-plugins/api/function/normalizeloosefiles)).

### minify

```ts
readonly minify?: boolean | undefined;
```

Minify the JS output of PROD groups only (dev is never minified). Defaults to false — this builder targets Node libraries where readable output is preferred.

### overrides

```ts
readonly overrides?: ReadonlyArray<EntryOverride> | undefined;
```

Entry partitions with their own format/bundling, built into the same outDir after the base entries. Used for per-entry format overrides (e.g. one CJS entry in an otherwise ESM-only package). The base `entry` must already EXCLUDE these entries.

### subdirExports

```ts
readonly subdirExports?: ReadonlySet<string> | undefined;
```

Export keys built into a `<key>/index.*` subdir (e.g. an RSPress `./runtime`).

### transform

```ts
readonly transform?: (args: {
    pkg: Json;
    targetGroup: TargetGroupRef;
  }) => Json;
```

### tsconfigPath

```ts
readonly tsconfigPath: string;
```

### verbose

```ts
readonly verbose?: boolean | undefined;
```

Compute gzip sizes for emitted files (verbose render). Forwarded to the metrics plugin.

### version

```ts
readonly version: string;
```

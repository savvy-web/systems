---
id: packages/tsdown-plugins/api/interface/entryoverride
title: "EntryOverride — tsdown-plugins interface"
summary: "One entry partition built with its own format + bundling posture, layered into the SAME outDir as the base build (clean:false). Anything omitted falls back to…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# EntryOverride

One entry partition built with its own format + bundling posture, layered into the SAME outDir as the base build (clean:false). Anything omitted falls back to the base build's value. `entry` is a subset of the package's entries (`entryName -> source path`).

```ts
interface EntryOverride
```

## Members

### bundle

```ts
readonly bundle?: ReadonlyArray<string> | undefined;
```

### bundledPackages

```ts
readonly bundledPackages?: ReadonlyArray<string> | undefined;
```

### bundleNodeModules

```ts
readonly bundleNodeModules?: boolean | undefined;
```

### css

```ts
readonly css?: CssOptions | undefined;
```

CSS handling forwarded to tsdown's `css` option (JS pass only). Enables `@tsdown/css`.

### dtsExternals

```ts
readonly dtsExternals?: ReadonlyArray<string> | undefined;
```

### entry

```ts
readonly entry: Record<string, string>;
```

### externals

```ts
readonly externals?: ReadonlyArray<string> | undefined;
```

### format

```ts
readonly format?: ReadonlyArray<BuildFormat> | undefined;
```

### outSubdir

```ts
readonly outSubdir?: string | undefined;
```

Build this partition into `<groupOutDir>/<outSubdir>/` instead of the shared group root. Isolates a sub-package (e.g. an RSPress `./runtime`) so its bundleless per-file output cannot collide with the base partition's output and its barrel path is deterministic. The partition's entry should be `{ index: <barrel source> }` so it emits `<outSubdir>/index.js` + `<outSubdir>/index.d.ts`.

### platform

```ts
readonly platform?: BuildPlatform | undefined;
```

JS-pass platform for this partition. Defaults to the base "node". Use "browser" for a web runtime.

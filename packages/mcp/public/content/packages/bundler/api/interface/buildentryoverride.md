---
id: packages/bundler/api/interface/buildentryoverride
title: "BuildEntryOverride — bundler interface"
summary: "interface BuildEntryOverride from @savvy-web/bundler."
tier: packages
source: generated
tags: [bundler, api]
priority: 0.3
related: []
---

# BuildEntryOverride

```ts
interface BuildEntryOverride
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

### entries

```ts
readonly entries: ReadonlyArray<string>;
```

Export paths to pin to this partition, e.g. "./changesets/markdownlint" (or "." for root).

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

Build this entry's partition into a `<group>/pkg/<outSubdir>/` subdir as an isolated sub-package (e.g. an RSPress `./runtime`). The export's built path becomes `./<outSubdir>/index.{js,d.ts}`. Exactly ONE export path may be pinned per `outSubdir` override.

### platform

```ts
readonly platform?: BuildPlatform | undefined;
```

JS-pass platform for this partition (default "node"). Use "browser" for an RSPress runtime.

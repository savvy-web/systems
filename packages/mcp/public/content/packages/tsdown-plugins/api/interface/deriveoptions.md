---
id: packages/tsdown-plugins/api/interface/deriveoptions
title: "DeriveOptions — tsdown-plugins interface"
summary: "interface DeriveOptions from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# DeriveOptions

```ts
interface DeriveOptions
```

## Members

### bundledPackages

```ts
readonly bundledPackages?: ReadonlyArray<string> | undefined;
```

External packages whose declarations should be INLINED into the bundled dts (the rslib `dtsBundledPackages` equivalent). Maps to tsdown's `deps.onlyBundle` in the dts pass, so ONLY these node_modules packages are rolled into the `.d.ts` and every other dependency stays an external `import`. dts-pass-only: runtime JS bundling is unaffected.

### cwd

```ts
readonly cwd: string;
```

### define

```ts
readonly define?: Record<string, string> | undefined;
```

Compile-time global replacements forwarded to the build `define`. Merged AFTER the auto-injected `process.env.__PACKAGE_VERSION__` so a user key of the same name wins. Values are inserted verbatim (string literals must already be quoted).

### devManifest

```ts
readonly devManifest: "preserve" | "resolve";
```

### entry

```ts
readonly entry: Record<string, string>;
```

### externals

```ts
readonly externals?: ReadonlyArray<string>;
```

### format

```ts
readonly format?: ReadonlyArray<BuildFormat> | undefined;
```

Output formats to emit. Defaults to esm-only when unset.

### group

```ts
readonly group: TargetGroupId;
```

### minify

```ts
readonly minify?: boolean | undefined;
```

Minify prod output (prod groups only; dev is never minified). Defaults to false.

### platform

```ts
readonly platform?: BuildPlatform | undefined;
```

JS-pass platform. Defaults to "node"; set "browser" for an RSPress runtime partition.

### tsconfigPath

```ts
readonly tsconfigPath: string;
```

### version

```ts
readonly version: string;
```

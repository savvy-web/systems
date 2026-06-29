---
id: packages/rspress-builder/api/interface/rspresspluginoptions
title: "RspressPluginOptions — rspress-builder interface"
summary: "Options for `definePlugin`. Deliberately small — RSPress plugins have a fixed shape."
tier: packages
source: generated
tags: [rspress-builder, api]
priority: 0.3
related: []
---

# RspressPluginOptions

Options for `definePlugin`. Deliberately small — RSPress plugins have a fixed shape.

```ts
interface RspressPluginOptions
```

## Members

### apiModel

```ts
readonly apiModel?: BuildConfigInput["meta"];
```

API-model generation. Defaults to on (documents plugin options AND runtime components). `false` opts out.

### define

```ts
readonly define?: Record<string, string>;
```

Build-wide compile-time global replacements forwarded to every partition (the bundler's `define` is [build](silk://packages/rspress-builder/api/function/build)-wide; there is no per-bundle define). Merged AFTER the `import.meta.env` identity map, so a user key may override it intentionally. Values are inserted verbatim (string literals must be quoted).

### dtsBundledPackages

```ts
readonly dtsBundledPackages?: ReadonlyArray<string>;
```

Packages whose declarations are inlined into the bundled dts (e.g. [`@rspress/core`]).

### jsx

```ts
readonly jsx?: BuildConfigInput["jsx"];
```

JSX override; defaults to tsconfig-inferred.

### plugin

```ts
readonly plugin?: RspressBundleOptions;
```

Tuning for the plugin (`.`) bundle (node, bundled).

### runtime

```ts
readonly runtime?: boolean | RspressBundleOptions;
```

Enable the `./runtime` bundle (browser, bundleless, CSS modules, React/`@theme` external). `true` (default) builds it; `false` disables it; an object tunes its externals. This does not auto-detect the filesystem — pass `false` for a plugin with no runtime.

### transform

```ts
readonly transform?: BuildConfigInput["transform"];
```

Final package.json mutation; defaults to the bundler's defaultManifestTransform.

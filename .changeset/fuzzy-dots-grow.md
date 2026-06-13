---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Platform and CSS support for entry override partitions

`EntryOverride` gains three new fields that let a single `defineBuild` produce a mixed-target package — for example, a Node plugin entry alongside a browser React runtime:

- `platform` (`BuildPlatform: "node" | "browser" | "neutral"`) — sets the JS-pass build platform for the partition. Defaults to `"node"`. Use `"browser"` for a web runtime that must run in a browser bundler rather than Node.
- `css` (`CssOptions`) — forwarded verbatim to tsdown's `css` option (consumed by `@tsdown/css`). Enables CSS modules for a partition's JS pass. The package being built must install `@tsdown/css`; tsdown loads it lazily.
- `outSubdir` (`string`) — builds the partition into an isolated `<groupOutDir>/<outSubdir>/` subdirectory instead of the shared group root. Isolates the sub-package so its bundleless per-file output cannot collide with the base partition, and gives it a deterministic barrel path (`<outSubdir>/index.js` + `<outSubdir>/index.d.ts`). Pin exactly one export path per `outSubdir` override.

```ts
// defineBuild overrides — plugin (node, bundled) + runtime (browser, bundleless, CSS modules)
overrides: [
  {
    entries: ["./runtime"],
    outSubdir: "runtime",
    platform: "browser",
    css: { modules: { localsConvention: "camelCaseOnly", namedExport: false }, inject: true },
    externals: ["react", "react/jsx-runtime", "@rspress/core", "@theme"],
  },
]
```

Two new types are exported from the package root: `BuildPlatform` and `CssOptions`.

### Subdirectory export manifest support

`BuildTargetGroupsOptions` gains a `subdirExports` field (`ReadonlySet<string>`). Export keys listed in `subdirExports` have their `package.json` export conditions rewritten to point at the isolated `<key>/index.*` subdir path rather than the flat `<name>.js` path. This is threaded automatically by `buildTargetGroups` when any override sets `outSubdir`.

## Bug Fixes

Declaration file inputs (`.d.ts`, `.d.cts`, `.d.mts`) are now treated as pass-through assets rather than TypeScript source files to build. Previously, a `.d.ts` export target was misclassified as a buildable TypeScript entry, producing a spurious `.d.ts.js` output and a crash when the dts pass tried to compile it. The fix affects both the entry extractor (`src/entry/extract.ts`) and the manifest transform (`src/manifest/transform.ts`).

# RSPress plugin builds

`@savvy-web/rspress-builder` is a thin preset over `@savvy-web/bundler` for building RSPress plugins that ship a Node plugin entry plus an optional browser runtime.

## Front-door example

```ts
import { build } from "@savvy-web/rspress-builder";

await build({ meta: { localPaths: ["../../website/lib/models/my-plugin"] } });
```

`definePlugin(options)` returns a standard `BuildConfig` if you need the escape hatch (`runBuild` is re-exported).

## `RspressPluginOptions`

| Option | What it does |
| --- | --- |
| `plugin` | `RspressBundleOptions` — dependency-posture tuning for the Node plugin entry `.`; externalizes `@rspress/core`. |
| `runtime` | `boolean \| RspressBundleOptions` — the isolated browser `./runtime` entry: bundleless, CSS-module, React, externalizes react, react/jsx-runtime, react/jsx-dev-runtime, `@theme`, `@rspress/core`. |
| `externals` | Build-wide externals. Merges into BOTH bundles' built-in lists — the one option that does not follow the per-bundle-wins rule below. |
| `bundledPackages` | Packages whose declarations are inlined into the bundled `.d.ts`, for example `["@rspress/core"]`. |
| `dtsExternals` | Packages externalized in the dts pass only (referenced via `import` in the emitted `.d.ts`) while the JS pass still bundles them. |
| `bundleNodeModules` | Force-bundle node_modules (and workspace) JS dependencies into the package output. |
| `meta` | Forwarded to the bundler's `meta` (API Extractor api-model generation; defaults to on). |
| `transform` | Final `package.json` mutation; defaults to the bundler's `defaultManifestTransform`. |
| `jsx` | JSX runtime override; defaults to tsconfig-inferred. |
| `define` | Compile-time global replacements, forwarded to every partition. |

`RspressBundleOptions` (the `plugin`/`runtime` object form) accepts `externals`, `bundledPackages`, `dtsExternals` and `bundleNodeModules`. `bundledPackages`, `dtsExternals` and `bundleNodeModules` can be set build-wide and/or tuned per bundle — a per-bundle value wins over the build-wide one of the same name.

`runtime` defaults to `true` (the runtime bundle is built) and does **not** auto-detect the filesystem — pass `runtime: false` explicitly for a plugin with no `./runtime` entry.

## Peer contract

The consumer must provide these peer dependencies: `@rspress/core`, `react`, `react-dom`, `typescript`. (`@tsdown/css` is a regular dependency of rspress-builder itself, not something the consumer supplies.)

## Ambient environment types

`@savvy-web/rspress-builder` ships a `./env` types-only export with the `import.meta.env` and `*.css`/`*.module.css` declarations an RSPress runtime component needs. Reference it from a `.d.ts` in the plugin package: `/// <reference types="@savvy-web/rspress-builder/env" />`.

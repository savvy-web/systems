# @savvy-web/rspress-builder

[![npm](https://img.shields.io/npm/v/@savvy-web%2Frspress-builder?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/rspress-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

Builds an [RSPress](https://rspress.rs/) plugin package on top of [`@savvy-web/bundler`](https://www.npmjs.com/package/@savvy-web/bundler). One `definePlugin` call produces the dual-bundle shape an RSPress plugin needs: a Node plugin entry plus a browser, bundleless, CSS-module React runtime entry, each with the right externals and platform already set.

## Install

```bash
npm install --save-dev @savvy-web/rspress-builder
# or
pnpm add -D @savvy-web/rspress-builder
```

`@rspress/core`, `react`, `react-dom` and `typescript` are peer dependencies the host plugin provides. `@tsdown/css` is a regular dependency of this package, so you do not install it yourself — tsdown loads it lazily when a CSS file is encountered.

## Quick start

Add a `savvy.build.ts` to the plugin package root and call `build()` — it derives `cwd` and `argv` from `process` and applies the `definePlugin` preset automatically:

```ts
// savvy.build.ts
import { build } from "@savvy-web/rspress-builder";

await build();
```

Pass options to tune the preset — for example, to bundle `@rspress/core` declarations into the output types or disable the runtime bundle for a plugin with no browser component:

```ts
await build({ bundledPackages: ["@rspress/core"] });
await build({ runtime: false });
```

Wire the build targets into `package.json` scripts and run them with Node's native TypeScript support:

```json
{
  "scripts": {
    "build:dev": "node savvy.build.ts --target dev",
    "build:prod": "node savvy.build.ts --target prod"
  }
}
```

The plugin entry (`.`) builds for Node with `@rspress/core` externalized. The runtime entry (`./runtime`) builds for the browser, bundleless, with CSS modules enabled and React, `@rspress/core` and `@theme` externalized so RSPress provides them at site build time.

For advanced use, `definePlugin` and `runBuild` remain exported as primitives.

## Configuration

`definePlugin` keeps a small surface because RSPress plugins have a fixed shape:

- `runtime` — build the `./runtime` bundle. `true` (default) builds it, `false` disables it for a plugin with no runtime, an object tunes its dependency posture (`externals`, `bundledPackages`, `dtsExternals`, `bundleNodeModules`). It does not probe the filesystem; pass `false` when there is no runtime entry.
- `plugin` — dependency posture tuning for the plugin (`.`) bundle; same shape as `runtime`'s object form.
- `externals` — build-wide externals merged into both bundles' built-in lists.
- `bundledPackages` — packages whose declarations are inlined into the bundled `.d.ts`, for example `["@rspress/core"]`.
- `dtsExternals` — packages externalized in the dts pass only (referenced via `import` in the emitted `.d.ts`) while the JS pass still bundles them.
- `bundleNodeModules` — force-bundle node_modules (and workspace) JS dependencies into the package output.
- `meta` — API Extractor api-model generation, on by default. Pass `false` to opt out.
- `transform`, `jsx`, `define` — forwarded to the underlying bundler config.

`bundledPackages`, `dtsExternals` and `bundleNodeModules` can be set build-wide and/or tuned per bundle via `plugin`/`runtime`; a per-bundle value wins over the build-wide one. `externals` is the exception — a build-wide value merges into BOTH bundles rather than being overridden.

## Ambient environment types

`@savvy-web/rspress-builder` ships a `./env` types-only export with the ambient declarations an RSPress runtime component needs: `import.meta.env` (Vite's build-mode env, `SSG_MD`/`SSR`/`MODE`/`BASE_URL`/`PROD`/`DEV`) plus `*.css` and `*.module.css` module declarations. Add a triple-slash reference to a `.d.ts` in your project to pull them in:

```ts
/// <reference types="@savvy-web/rspress-builder/env" />
```

`@savvy-web/bundler` ships the same pattern for its own build-injected key — see [its README](https://www.npmjs.com/package/@savvy-web/bundler#readme) — via `/// <reference types="@savvy-web/bundler/env" />`, which gives you `process.env.__PACKAGE_VERSION__`.

## License

[MIT](LICENSE)

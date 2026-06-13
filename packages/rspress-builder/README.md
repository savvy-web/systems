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

`@rspress/core`, `react`, `react-dom` and `@tsdown/css` are peer dependencies the host plugin provides.

## Quick start

Add a `savvy.build.ts` to the plugin package root. `definePlugin` returns a standard bundler config, which the re-exported `runBuild` consumes unchanged:

```ts
// savvy.build.ts
import { definePlugin, runBuild } from "@savvy-web/rspress-builder";

const config = definePlugin({ runtime: true, dtsBundledPackages: ["@rspress/core"] });

export default config;

if (import.meta.main) {
  await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
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

## Configuration

`definePlugin` keeps a small surface because RSPress plugins have a fixed shape:

- `runtime` — build the `./runtime` bundle. `true` (default) builds it, `false` disables it for a plugin with no runtime, an object tunes its externals. It does not probe the filesystem; pass `false` when there is no runtime entry.
- `plugin` — externals tuning for the plugin (`.`) bundle.
- `dtsBundledPackages` — packages whose declarations are inlined into the bundled `.d.ts`, for example `["@rspress/core"]`.
- `apiModel` — API Extractor api-model generation, on by default. Pass `false` to opt out.
- `transform`, `jsx`, `define` — forwarded to the underlying bundler config.

## License

[MIT](LICENSE)

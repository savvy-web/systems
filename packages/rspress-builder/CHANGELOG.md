# @savvy-web/rspress-builder

## 0.8.0

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 0.7.0 | 0.8.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.7.0 | 0.8.0 |

## 0.1.3

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 0.6.1 | 0.7.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.6.0 | 0.7.0 |

## 0.1.2

### Patch Changes

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 0.6.0 | 0.6.1 |

## 0.1.1

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 0.5.0 | 0.6.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.5.0 | 0.6.0 |

## 0.1.0

### Features

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) `@savvy-web/rspress-builder` is a new package for building RSPress plugin packages. RSPress plugins have a fixed shape — a Node plugin entry (`.`) and an optional browser React runtime entry (`./runtime`) — so the package exposes a single configuration function that wires everything correctly.

### `definePlugin()`

Returns a standard `BuildConfig` for a package that ships both a Node plugin bundle and a browser-targeted, bundleless, CSS-module React runtime bundle. Hand the result to `runBuild` from a self-executing `savvy.build.ts`:

```ts
// savvy.build.ts
import { definePlugin, runBuild } from "@savvy-web/rspress-builder";

const config = definePlugin({
  // runtime: true (default) — builds the ./runtime browser bundle
  // runtime: false — plugin-only, no runtime
  // runtime: { externals: ["my-extra-dep"] } — tunes runtime externals
  dtsBundledPackages: ["@rspress/core"], // inline @rspress/core declarations into dts
});

export default config;

if (import.meta.main) {
  await runBuild(config, {
    cwd: import.meta.dirname,
    argv: process.argv.slice(2),
  });
}
```

The plugin bundle externalizes `@rspress/core`. The runtime bundle externalizes `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `@rspress/core`, and `@theme` — these are provided by RSPress at site-build time. `import.meta.env` is preserved as-is so RSPress can resolve `SSG_MD` and other env flags per site.

### Shipped consumer tsconfig preset

`@savvy-web/rspress-builder/tsconfig/plugin.json` is a ready-to-use TSConfig for RSPress plugin source: self-contained (extends a colocated `./ecma.json` copy so it resolves even when `@savvy-web/bundler` is only a transitive dependency), sets `jsx: "react-jsx"`, includes the `dom` lib, and types `node`/`react`/`react-dom`. Reference it from your package's `tsconfig.json` with `"extends": "@savvy-web/rspress-builder/tsconfig/plugin.json"`.

### Ambient CSS and `import.meta.env` typings

`@savvy-web/rspress-builder/rspress-env.d.ts` provides:

* `*.module.css` and `*.css` ambient module declarations for CSS module imports.
* `ImportMetaEnv` with `SSG_MD?: boolean` and an open string index.

Reference it from a `types/*.d.ts` in your package with a triple-slash directive — `/// <reference types="@savvy-web/rspress-builder/rspress-env.d.ts" />` — to get correct types for CSS imports and `import.meta.env` in your runtime source.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 0.4.2 | 0.5.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.4.2 | 0.5.0 |

# @savvy-web/bundler

## 0.4.1

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.4.0 | 0.4.1 |

## 0.4.0

### Features

* [`2675852`](https://github.com/savvy-web/systems/commit/26758526060024d616a059799c04cd7965b57360) A `looseFiles` option on `defineBuild` for emitting standalone, self-contained bundled files at literal output paths outside the exports, declaration, and API-model graph. Keys are literal output filenames; values are a source path or a source-plus-format object. Module format is inferred from a `.mjs` or `.cjs` key and required for an ambiguous `.js` key. Pair with `bundleNodeModules` to make each file fully self-contained. This supports building pnpm config dependencies, which forbid runtime dependencies and resolve their `pnpmfile.mjs`/`pnpmfile.cjs` by filename at the package root.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.3.0 | 0.4.0 |

## 0.3.0

### Features

* [`bffeffe`](https://github.com/savvy-web/systems/commit/bffeffee4f7d1b9decfbc040790650bfee2e7667) ### `define` option on `defineBuild`

Pass compile-time global replacements directly from `defineBuild`. The values are forwarded verbatim to the underlying tsdown/rolldown `define` — string literals must be pre-quoted:

```ts
import { defineBuild } from "@savvy-web/bundler";

export default defineBuild({
  define: {
    "process.env.FLAG": JSON.stringify("on"),
    "process.env.API_URL": JSON.stringify("https://api.example.com"),
  },
});
```

User-supplied keys are merged with the auto-injected `process.env.__PACKAGE_VERSION__` define; when a user key collides with the auto-version key, the user value wins.

### Bug Fixes

* [`bffeffe`](https://github.com/savvy-web/systems/commit/bffeffee4f7d1b9decfbc040790650bfee2e7667) The auto-injected package version define previously used the bare identifier `__PACKAGE_VERSION__` as its key. rolldown only replaces `define` keys when the source contains a literal token match, so a bare identifier key never matched the `process.env.__PACKAGE_VERSION__` member expression that packages actually read. The key is now `process.env.__PACKAGE_VERSION__`. Packages whose source reads `process.env.__PACKAGE_VERSION__` (including `@savvy-web/cli` and `@savvy-web/github-action-builder`) previously shipped with the version unreplaced and reported `0.0.0` at runtime; they now report the real version.

### `meta` is now optional — `savvy build --target meta` works without configuration

The `meta` option is now tri-state. Omit it (or leave it `undefined`) and api-model generation runs with default options: `savvy build --target meta` works out of the box and `savvy build --target prod` emits the meta release asset. Pass an object only to override defaults (`localPaths`, `tsdoc`). Pass `false` to opt out entirely — both targets become no-ops:

```ts
export default defineBuild({
  // omit meta entirely  -> generate with defaults
  // meta: { localPaths: ["../models"] }  -> override defaults
  meta: false, // -> skip api-model generation on both --target meta and --target prod
});
```

Previously an empty `meta: {}` object was required just to make `--target meta` runnable — omitting it threw `requires a 'meta' option`. That boilerplate is gone.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.2.1 | 0.3.0 |

## 0.2.1

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.2.0 | 0.2.1 |

## 0.2.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Initial `@savvy-web/bundler` program — the tsdown-based replacement for `@savvy-web/rslib-builder`

The `defineBuild`/`runBuild` orchestrator and self-executing `savvy.build.ts` contract driving tsdown over `@savvy-web/tsdown-plugins`:

* SP1 foundation; catalog/`workspace:` resolution delegated to `workspaces-effect`'s `CatalogResolver`; a `ConfigValidator` gate that fast-fails on bad config across dev/npm/meta/exe.
* Track A meta generation (`--target meta` API Extractor model into `localPaths`, npm `meta/` release asset), Track C multi-target publishing (`--target prod` derives byte-variant groups from the Record-map `publishConfig.targets` and writes the `dist/prod/targets.json` binding), Track B SEA exe compilation (`--target exe`), Track D tsconfig-inherited JSX.
* M1 dual esm+cjs format, M2 self-hosting, M3 bundled-dts two-pass build, M4-M6 bundling-posture controls (`bundleNodeModules`/`bundle`/`bundledPackages`/`dtsExternals`), per-entry `overrides`, fluent defaults (`defaultManifestTransform`, unminified prod), and the shipped `@savvy-web/bundler/ecma.json` TS base config.

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
* Strip prod `.d.ts.map`/`.d.cts.map` from published output.

### Self-hosting builds now emit the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), and `@savvy-web/bundler`'s own `publishConfig.targets` is the Record-map `{ npm: true, github: true }` — so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.1.0 | 0.2.0 |

## 0.1.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Initial `@savvy-web/bundler` program — the tsdown-based replacement for `@savvy-web/rslib-builder`

The `defineBuild`/`runBuild` orchestrator and self-executing `savvy.build.ts` contract driving tsdown over `@savvy-web/tsdown-plugins`:

* SP1 foundation; catalog/`workspace:` resolution delegated to `workspaces-effect`'s `CatalogResolver`; a `ConfigValidator` gate that fast-fails on bad config across dev/npm/meta/exe.
* Track A meta generation (`--target meta` API Extractor model into `localPaths`, npm `meta/` release asset), Track C multi-target publishing (`--target prod` derives byte-variant groups from the Record-map `publishConfig.targets` and writes the `dist/prod/targets.json` binding), Track B SEA exe compilation (`--target exe`), Track D tsconfig-inherited JSX.
* M1 dual esm+cjs format, M2 self-hosting, M3 bundled-dts two-pass build, M4-M6 bundling-posture controls (`bundleNodeModules`/`bundle`/`bundledPackages`/`dtsExternals`), per-entry `overrides`, fluent defaults (`defaultManifestTransform`, unminified prod), and the shipped `@savvy-web/bundler/ecma.json` TS base config.

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
* Strip prod `.d.ts.map`/`.d.cts.map` from published output.

### Self-hosting builds now emit the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), and `@savvy-web/bundler`'s own `publishConfig.targets` is the Record-map `{ npm: true, github: true }` — so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.0.0 | 0.1.0 |

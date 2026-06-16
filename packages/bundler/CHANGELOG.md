# @savvy-web/bundler

## 0.6.0

### Features

* [`2d7893a`](https://github.com/savvy-web/systems/commit/2d7893afbd2f82324f94a2a70eeeac2ee4b28b89) ### SEA compilation is now a step of every dev and prod build

A package that ships a single-executable (SEA) binary via `defineBuild({ exe })` no longer needs the standalone `--target exe` target to produce a usable artifact. A normal `--target dev`/`--target prod` build now emits the binary AND programs the manifest to point at its computed, platform-suffixed filename — the `exports`/`bin` entry resolves to the SEA and the binary is added to `files`. The exe entry source is excluded from the JS pass, so a pure-binary package emits no dead JS stub. The SEA is compiled last, into each built group's `pkg/bin`, so the dev `clean` cannot wipe it. The standalone `--target exe` target is retained as a manual escape hatch.

### `--no-exe` skips the SEA compile while still programming the manifest

`parseArgs` now recognizes `--no-exe`. A `--target dev --no-exe` build programs the manifest with the computed binary name but skips the cross-compile, so `prepare` and frozen-lockfile installs never cross-compile a SEA — important on Linux install steps where extracting a Windows SEA fails. The full `build:dev`/`build:prod` runs do the actual cross-compile.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.5.0 | 0.6.0 |

## 0.5.0

### Features

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) ### Per-override platform, CSS, and subdir partitions in `BuildEntryOverride`

`BuildEntryOverride` gains three new fields that mirror the `tsdown-plugins` capabilities:

* `platform` (`BuildPlatform`) — sets the JS-pass build platform for this partition. Defaults to `"node"`. Use `"browser"` for a web runtime.
* `css` (`CssOptions`) — forwarded to tsdown's `css` option (JS pass only). Enables CSS module support for a browser partition. The consuming package must install `@tsdown/css`.
* `outSubdir` (`string`) — builds the partition into `<group>/pkg/<outSubdir>/` as an isolated sub-package. The export's built path becomes `./<outSubdir>/index.{js,d.ts}`. Exactly one export path may be pinned per `outSubdir` override.

### Subdir meta inputs for API model generation

When an override sets `outSubdir`, `runBuild` now correctly points that export's API Extractor input at the isolated `<outSubdir>/index.d.ts` barrel rather than the flat `<name>.d.ts` path. This ensures a subdir export (for example a `./runtime` entry) contributes its declarations to the API model under `--target meta` and `--target prod`.

`subdirExports` is derived automatically from the `overrides` list and forwarded to `buildTargetGroups` — no manual configuration is required.

### TSConfig export moved under the `tsconfig/` namespace

The shared base config is now also exported as `@savvy-web/bundler/tsconfig/ecma.json`, aligning with the `tsconfig/` export convention used across the Silk build tooling. The existing `@savvy-web/bundler/ecma.json` export is retained as a deprecated alias (both point at the same file) and will be removed in the next major. Migrate `"extends"` references to `@savvy-web/bundler/tsconfig/ecma.json`.

The shared base also bumps `target` from `es2023` to `es2025`, reflecting the Node.js 24 baseline. Packages extending it now type-check against the ES2025 language level.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.4.2 | 0.5.0 |

## 0.4.2

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.4.1 | 0.4.2 |

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

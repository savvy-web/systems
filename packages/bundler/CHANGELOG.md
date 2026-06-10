# @savvy-web/bundler

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

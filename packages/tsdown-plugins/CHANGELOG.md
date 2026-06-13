# @savvy-web/tsdown-plugins

## 0.4.2

### Dependencies

* | [`56fc55a`](https://github.com/savvy-web/systems/commit/56fc55aceb389c10ab8da1c962a464c758a936fc) | Dependency | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :------ | :------ | -- |
  | @microsoft/api-extractor                                                                          | dependency | updated | ^7.58.8 | ^7.58.9 |    |

## 0.4.1

### Dependencies

* | [`e6e3ee4`](https://github.com/savvy-web/systems/commit/e6e3ee464b9e5ae56e45acbf03b583e1bc11d7c3) | Dependency | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :------ | :------ | -- |
  | @microsoft/api-extractor                                                                          | dependency | updated | ^7.58.8 | ^7.58.9 |    |

### Other

* [`49f5733`](https://github.com/savvy-web/systems/commit/49f5733639fa87562813b2c52c06293970409a43) Lock tsdown peer versioning.

## 0.4.0

### Features

* [`2675852`](https://github.com/savvy-web/systems/commit/26758526060024d616a059799c04cd7965b57360) A `normalizeLooseFiles` helper and `looseFiles` support in `buildTargetGroups`. Each loose file builds as one extra single-entry, bundled, declaration-free, manifest-free tsdown pass per target group, inheriting the group's bundling posture so the output is self-contained. The `ConfigValidator` validates loose files structurally (supported extension, format inference, and contradiction checks) before any build work.

## 0.3.0

### Features

* [`bffeffe`](https://github.com/savvy-web/systems/commit/bffeffee4f7d1b9decfbc040790650bfee2e7667) ### `define` threaded through `buildTargetGroups`

`buildTargetGroups` and the derive helpers now accept and forward a `define` map — compile-time global replacements passed through to each tsdown/rolldown build group. Merged with the auto-injected `process.env.__PACKAGE_VERSION__` define; user keys of the same name win.

### Bug Fixes

* [`bffeffe`](https://github.com/savvy-web/systems/commit/bffeffee4f7d1b9decfbc040790650bfee2e7667) The auto-injected package version `define` key was the bare identifier `__PACKAGE_VERSION__`. rolldown matches `define` keys against token occurrences, so the bare identifier never replaced the `process.env.__PACKAGE_VERSION__` member expression that consumers actually read. The key is now `process.env.__PACKAGE_VERSION__`, restoring correct version injection at build time.

### Auto `./package.json` export in built manifests

`transformManifest` now automatically injects `"./package.json": "./package.json"` into a package's `exports` map when an `exports` field is present and the entry is absent. This follows standard npm practice and allows consumers to import the package's own manifest:

```ts
import pkg from "my-package/package.json" assert { type: "json" };
```

The injection runs before any user-supplied `transform`, so a custom transform can still remove the entry if needed. Packages that declare no `exports` field at all are unaffected (they already expose everything).

## 0.2.1

### Dependencies

* | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | sort-package-json                                                                                 | dependency | updated | ^3.6.1 | ^4.0.0 |    |

## 0.2.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Initial `@savvy-web/tsdown-plugins` program — the interface-only tsdown/rolldown plugin pack

Holds every build behavior behind the `@savvy-web/bundler` orchestrator: entry detection, manifest transforms + catalog delegation over `workspaces-effect`'s `CatalogResolver`, the dts resolved-tsconfig port, the name-aware two-pass `buildTargetGroups` (per-module JS pass + bundled `emitDtsOnly` dts pass), the Effect output reporter, the `src/meta/` API Extractor pipeline (`generateMeta`, portable-tsconfig resolver, `syncPublicDir`), the `src/targets/` derivation (`resolveTargets`/`writeTargetsBinding`, throwing `ConfigValidationError`), the `src/jsx/` config, and the `src/exe/` SEA support.

Includes M1 dual-format threading, M3 bundled dts (TS2883 fix), M4-M6 bundling-posture capabilities, per-entry override partitions, the `defaultManifestTransform`/`removeDeclarationMaps` helpers, the synced `ecma.json` copy, and the `ConfigValidator` rule set. Authored against rolldown's `Plugin` type only (no tsdown peer).

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
* Strip prod `.d.ts.map`/`.d.cts.map` from published output.

### Self-hosting build now emits the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.

## 0.1.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Initial `@savvy-web/tsdown-plugins` program — the interface-only tsdown/rolldown plugin pack

Holds every build behavior behind the `@savvy-web/bundler` orchestrator: entry detection, manifest transforms + catalog delegation over `workspaces-effect`'s `CatalogResolver`, the dts resolved-tsconfig port, the name-aware two-pass `buildTargetGroups` (per-module JS pass + bundled `emitDtsOnly` dts pass), the Effect output reporter, the `src/meta/` API Extractor pipeline (`generateMeta`, portable-tsconfig resolver, `syncPublicDir`), the `src/targets/` derivation (`resolveTargets`/`writeTargetsBinding`, throwing `ConfigValidationError`), the `src/jsx/` config, and the `src/exe/` SEA support.

Includes M1 dual-format threading, M3 bundled dts (TS2883 fix), M4-M6 bundling-posture capabilities, per-entry override partitions, the `defaultManifestTransform`/`removeDeclarationMaps` helpers, the synced `ecma.json` copy, and the `ConfigValidator` rule set. Authored against rolldown's `Plugin` type only (no tsdown peer).

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
* Strip prod `.d.ts.map`/`.d.cts.map` from published output.

### Self-hosting build now emits the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.

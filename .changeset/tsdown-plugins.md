---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Initial `@savvy-web/tsdown-plugins` program — the interface-only tsdown/rolldown plugin pack

Holds every build behavior behind the `@savvy-web/bundler` orchestrator: entry detection, manifest transforms + catalog delegation over `workspaces-effect`'s `CatalogResolver`, the dts resolved-tsconfig port, the name-aware two-pass `buildTargetGroups` (per-module JS pass + bundled `emitDtsOnly` dts pass), the Effect output reporter, the `src/meta/` API Extractor pipeline (`generateMeta`, portable-tsconfig resolver, `syncPublicDir`), the `src/targets/` derivation (`resolveTargets`/`writeTargetsBinding`, throwing `ConfigValidationError`), the `src/jsx/` config, and the `src/exe/` SEA support.

Includes M1 dual-format threading, M3 bundled dts (TS2883 fix), M4-M6 bundling-posture capabilities, per-entry override partitions, the `defaultManifestTransform`/`removeDeclarationMaps` helpers, the synced `ecma.json` copy, and the `ConfigValidator` rule set. Authored against rolldown's `Plugin` type only (no tsdown peer).

### Self-hosting build now emits the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.

## Bug Fixes

- CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
- Strip prod `.d.ts.map`/`.d.cts.map` from published output.

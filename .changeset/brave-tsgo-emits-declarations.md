---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Declaration emission on the TypeScript 7.1 compiler API

The declaration (`.d.ts`) pass now runs on TypeScript 7.1's compiler API through rolldown-plugin-dts' `tsgo` generator instead of TypeScript 6 and the `tsc` generator. The package pins `typescript` to `7.1.0-beta`.

* `deriveDtsPassOptions` and `deriveDeclarationsPassOptions` now emit `generator: "tsgo"` plus a `tsgo.moduleUrl` that points at this package's own `typescript`, so the same compiler is used in every install layout
* New exports: the `DtsPassDtsOptions` type and the `dtsPassDtsOptions` helper that builds it
* rolldown-plugin-dts' "TypeScript Go is experimental" notice is filed under the suppressed bucket as `TSGO_EXPERIMENTAL` instead of surfacing as a warning
* Emitted declarations are otherwise unchanged, apart from improvements from the new compiler such as constants that previously emitted as `any` now emitting their real type

### API Extractor keeps its bundled TypeScript

`runApiExtractor` no longer passes `typescriptCompilerFolder`, so API Extractor analyzes with its own bundled TypeScript 6. Support for the TypeScript 7 port is tracked upstream in microsoft/rushstack#6033.

## Bug Fixes

* Fixed the API Extractor meta pass crashing with `EISDIR` ("Target is a folder, not a file") on a rollup containing a compiler-synthesized mixin base such as `declare const X_base` (savvy-web/systems#817). rolldown 1.2.15 records such declarations as source-less map segments, which API Extractor resolved to the package directory; the pass now scrubs source-less segments from the declaration maps it reads before invoking API Extractor
* Fixed "No TypeScript Go project found" when the build directory is reached through a symlink or when the base tsconfig has no `include`. The generated emit tsconfig now names its base config canonically and restates `files`, `include` and `exclude` as absolute canonical paths

## Dependencies

| Dependency | Type | Action | From | To |
| :--------- | :--- | :----- | :--- | :-- |
| typescript | dependency | updated | ^6.0.3 | 7.1.0-beta |
| @jridgewell/sourcemap-codec | dependency | added | — | ^1.6.0 |
| @microsoft/api-extractor | dependency | updated | 7.59.1 | ^7.59.4 |
| @microsoft/tsdoc | dependency | updated | ~0.16.0 | ~0.17.1 |
| @microsoft/tsdoc-config | dependency | updated | 0.18.1 | ~0.18.3 |

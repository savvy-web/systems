---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### Bundled declarations by default

Every build now emits per-module JavaScript alongside a single rolled-up, self-contained `.d.ts` per public entry, replacing the previous per-module declarations. This is a behavior change to published output: a consumer that infers a re-exported type from a package which exposes only a bundled-namespace entry no longer hits TS2883 ("the inferred type cannot be named ... not portable"), because every re-exported type now has its canonical declaration in the entry's own declaration file.

#### `@savvy-web/tsdown-plugins`

* The per-target build loop runs two tsdown passes per target group: a JavaScript pass (`unbundle: true`, declarations off) that keeps per-module output and runs the manifest plugin plus the `public/` copy, then a declaration-only pass (`unbundle: false`, `emitDtsOnly`, `clean: false`) that rolls every entry's declarations into one file without disturbing the JavaScript output. A single pass cannot achieve this because `unbundle` maps to rolldown's `preserveModules` for the whole build, including the declaration pass.
* New `deriveDtsPassOptions` plus a `DerivedDtsPassOptions` type carry the declaration-pass configuration; `deriveTargetGroupOptions` now derives the JavaScript pass.

#### `@savvy-web/bundler`

* Builds emit bundled, self-contained declarations per public entry by default while keeping JavaScript per-module. The output is byte-equivalent for JavaScript; only the declaration layout changed.

### Shared TypeScript base config

`@savvy-web/bundler` now ships a TypeScript base config at the `@savvy-web/bundler/ecma.json` subpath export. It is the replacement for `@savvy-web/rslib-builder/tsconfig/ecma/lib.json`: a consumer extends it from a package's `tsconfig.json` with `"extends": ["@savvy-web/bundler/ecma.json"]`. The bundler ships the file through the `public/` copy convention and extends its own copy by relative path to avoid a build-before-typecheck cycle; `@savvy-web/tsdown-plugins`, which is upstream of the bundler, keeps a byte-identical synced local copy guarded by a unit test.

### Self-hosting

`@savvy-web/tsdown-plugins` and `@savvy-web/bundler` now build themselves through a `savvy.build.ts` escape hatch over `buildTargetGroups`, no longer through `@savvy-web/rslib-builder`. tsdown-plugins imports the helper from its own source; the bundler imports it from the already-built tsdown-plugins.

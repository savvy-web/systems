---
"@savvy-web/bundler": minor
---

## Features

### Per-override platform, CSS, and subdir partitions in `BuildEntryOverride`

`BuildEntryOverride` gains three new fields that mirror the `tsdown-plugins` capabilities:

- `platform` (`BuildPlatform`) — sets the JS-pass build platform for this partition. Defaults to `"node"`. Use `"browser"` for a web runtime.
- `css` (`CssOptions`) — forwarded to tsdown's `css` option (JS pass only). Enables CSS module support for a browser partition. The consuming package must install `@tsdown/css`.
- `outSubdir` (`string`) — builds the partition into `<group>/pkg/<outSubdir>/` as an isolated sub-package. The export's built path becomes `./<outSubdir>/index.{js,d.ts}`. Exactly one export path may be pinned per `outSubdir` override.

### Subdir meta inputs for API model generation

When an override sets `outSubdir`, `runBuild` now correctly points that export's API Extractor input at the isolated `<outSubdir>/index.d.ts` barrel rather than the flat `<name>.d.ts` path. This ensures a subdir export (for example a `./runtime` entry) contributes its declarations to the API model under `--target meta` and `--target prod`.

`subdirExports` is derived automatically from the `overrides` list and forwarded to `buildTargetGroups` — no manual configuration is required.

### TSConfig export moved under the `tsconfig/` namespace

The shared base config is now also exported as `@savvy-web/bundler/tsconfig/ecma.json`, aligning with the `tsconfig/` export convention used across the Silk build tooling. The existing `@savvy-web/bundler/ecma.json` export is retained as a deprecated alias (both point at the same file) and will be removed in the next major. Migrate `"extends"` references to `@savvy-web/bundler/tsconfig/ecma.json`.

The shared base also bumps `target` from `es2023` to `es2025`, reflecting the Node.js 24 baseline. Packages extending it now type-check against the ES2025 language level.

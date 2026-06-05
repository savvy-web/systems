---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### Dual-format esm+cjs builds

A package can now build both ESM and CommonJS output from one build, so it can serve `require()` consumers alongside `import` consumers. The format is opt-in: builds stay ESM-only by default, so every existing build is byte-unchanged.

#### `@savvy-web/tsdown-plugins`

* The per-target build loop's output format is now configurable. A new `BuildFormat` type (`"esm" | "cjs"`) plus an optional `format` on `DeriveOptions`/`BuildTargetGroupsOptions` thread the requested formats through `deriveTargetGroupOptions` into the tsdown build; it defaults to esm-only. New export: the `BuildFormat` type.
* When a build includes `cjs`, the emitted `package.json` carries dual `import`/`require` export conditions. The manifest transform gained a `dual` flag (threaded through `emitManifest`) that adds a `require` condition (`.cjs`) alongside the existing `import` (`.js`) and `types` (`.d.ts`) for each TypeScript export.
* CJS named-export interop is enabled (via tsdown's `cjsDefault`) only when `cjs` is in the format, so the CommonJS output is require-able and its named exports survive. CJS declarations (`.d.cts`) are emitted automatically by the dts pass. For a `type: module` package, ESM lands at `.js` and CJS at `.cjs` with no extension collision (`fixedExtension` stays false).

#### `@savvy-web/bundler`

* `defineBuild({ format })` accepts `ReadonlyArray<"esm" | "cjs">` to opt into a dual-format build, mirroring how `jsx` and `exe` are configured. `runBuild` forwards the format into the build; with no `format` set, the build stays esm-only and unchanged.
* A dual-format build produces an ESM `index.js`, a require-able CommonJS `index.cjs`, and a `package.json` carrying both `import` and `require` export conditions.

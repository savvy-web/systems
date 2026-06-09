---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### Fluent defaults: automatic manifest stripping and unminified prod output

Two `defineBuild` defaults so a `savvy.build.ts` needs less configuration.

#### Default manifest transform

`defineBuild` now applies a default `transform` that strips the build/dev-only package.json fields (`devDependencies`, `bundleDependencies`, `scripts`, `publishConfig`, `packageManager`, `devEngines`) from the emitted manifest — the pattern nearly every package repeated by hand (inherited from rslib-builder). A package supplies a `transform` only for genuinely custom manifest work; doing so REPLACES the default. The new `defaultManifestTransform` helper is exported from both `@savvy-web/tsdown-plugins` and `@savvy-web/bundler`, so a custom transform can call it to keep the stripping. New export: `defaultManifestTransform`.

#### `minify` option (prod output now unminified by default)

`defineBuild({ minify })` controls minification of prod output. It defaults to **false** and applies to prod target groups only (dev is never minified). This builder targets Node libraries, where readable output matters more than bundle size: minified/obfuscated output trips security and SCA scanners and degrades stack traces. Set `minify: true` to opt back in. This changes the default prod output from minified to readable.

---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Cross-build Open Graph image cache

Generated Open Graph images can now be reused across builds. Renders are cached under `<pkg>/node_modules/.cache/tsdown-plugins/og`, keyed on the exact `info` the generator receives plus a salt that names the generator's identity, so an unchanged card is not re-rendered. The cache is best-effort: an unreadable or unwritable cache directory counts as a miss and never fails a build that rendered a valid image.

* New `openGraph.cacheSalt?: string | false` option on `TsdoctorMetaOptions`. A string caches under that salt (change it whenever your generator's output changes for the same input), `false` disables caching, and omitting it uses the generator's own `cacheSalt` if it has one and otherwise always regenerates.
* New exported `OgImageGenerator` interface: the `generate` function plus an optional readonly `cacheSalt`.
* New exports `OgImageCacheOptions` and `resolveOgCacheSalt(generate, cacheSalt)`, and an optional `cache` option on `WriteGeneratedOgImageOptions`.

### Validated generator output

`writeGeneratedOgImage` now validates generator output through `@effected/images`, accepting `png`, `jpeg`, and `webp`. Bytes that are not one of those image types still fail the build with a typed `OgGenerateError`.

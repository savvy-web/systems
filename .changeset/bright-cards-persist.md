---
"@savvy-web/bundler": minor
---

## Features

* `ogImage.satori()` from `@savvy-web/bundler/og` now returns an `OgImageGenerator` carrying a `cacheSalt` derived from the bundler version, the installed `satori` and `@resvg/resvg-js` versions, and the card colors. The built-in Open Graph card is therefore cached across builds by default; set `openGraph.cacheSalt: false` to always regenerate.
* The `OgImageGenerator` type is re-exported from `@savvy-web/bundler`.

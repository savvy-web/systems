---
"@savvy-web/tsdown-plugins": minor
---

## Features

* The build issues artifact (`dist/<target>/issues.json`) now stamps `buildOk: boolean`, plus an optional `failure: { name?, message }` when the build ended in a terminal error. The artifact is written on every terminal path — success and failure — so a crashed build (a blown-up API Extractor pass, a racing `rm -rf dist`) no longer reads as a clean gate with every diagnostic bucket simply empty; readers must gate on `buildOk`, not `errors.length`.
* The artifact write is now atomic: the JSON lands in a sibling temp file that is renamed over the destination, so a concurrent reader never observes a torn or half-written file.

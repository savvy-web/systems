---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

- `removeDeclarationMaps`, `copyPublicDir` and the declaration-map scrub accept a directory relative to the working directory again. `@effected/walker` 0.22 refuses a relative walk root, so a build called with a relative `cwd` would otherwise have thrown while stripping declaration maps.

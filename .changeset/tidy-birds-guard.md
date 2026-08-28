---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

- Tighten Biome schema URL handling so only an exact `biomejs.dev` hostname is considered managed.
- Update only the `$schema` field during Biome schema sync instead of replacing every matching URL string in the file.

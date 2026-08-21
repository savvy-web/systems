---
"@savvy-web/templates": minor
---

## Bug Fixes

The `biomeVersion` default used when scaffolding a workspace was pinned at `2.3.3`, two minor lines behind the suite. Because the generated `biome.jsonc` `$schema` URL is what CI reads to install the Biome binary, every scaffolded repo was provisioning a stale toolchain. The default is now `2.5.9`.

---
"@savvy-web/cli": minor
---

## Maintenance

`BIOME_VERSION` moves to `2.5.9`, the release the suite now pins. `savvy init` and `savvy check` write and validate consumer `biome.json`/`biome.jsonc` `$schema` URLs against it, so both commands now carry repos onto 2.5.9 — which is also what the shared `silk.jsonc` preset requires.

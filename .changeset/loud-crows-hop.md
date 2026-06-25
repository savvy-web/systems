---
"@savvy-web/cli": patch
---

## Bug Fixes

Fixed `savvy init` and `savvy check` not writing or validating Biome `$schema` URLs.

The commands read a `BIOME_VERSION` constant (now `2.5.1`) from a dedicated internal module. Previously they read `__BIOME_PEER_VERSION__`, an env var that was never populated at runtime, so the schema-sync path was silently inert. Running `savvy init` now writes the correct `$schema` URL into consumer `biome.json`/`biome.jsonc` files, and `savvy check` now reports when those URLs are stale.

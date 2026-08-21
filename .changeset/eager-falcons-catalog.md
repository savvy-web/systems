---
"@savvy-web/pnpm-plugin-silk": minor
---

## Maintenance

The `lint` and `lint:peers` catalogs now resolve `@biomejs/biome` to `2.5.9`, up from `2.5.0`.

This matters beyond a routine version bump. `savvy init` and `savvy check` write a `2.5.9` `$schema` URL into a consumer's `biome.json`/`biome.jsonc`, and CI reads that URL to decide which Biome binary to install. While the catalog still resolved `2.5.0`, a repo could end up running one Biome locally and another in CI — and `2.5.0` predates `linter.rules.preset`, which the `@savvy-web/silk` preset now uses, so the config could fail to parse on the older binary.

---
"@savvy-web/cli": patch
---

## Maintenance

- `savvy init` now writes the `$schema` URL `https://unpkg.com/@changesets/config@4.0.0-next.6/schema.json` in generated `.changeset/config.json` files (was `@changesets/config@3.1.1`), keeping generated scaffolding in sync with the v3 config schema.

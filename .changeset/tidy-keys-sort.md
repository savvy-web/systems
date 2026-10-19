---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

* The `pnpm-workspace.yaml` formatter (the lint-staged handler and `savvy lint fmt pnpm-workspace`) no longer hoists the `packages` key to the top. It now sorts `packages` alphabetically with every other top-level key, so existing files have `packages` moved into sorted position the next time they are formatted.

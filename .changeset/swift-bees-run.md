---
"@savvy-web/silk": patch
---

## Bug Fixes

Updated the shipped Biome asset (`@savvy-web/silk/biome`) to Biome 2.5.1 and broadened the `noUndeclaredDependencies` suppression override.

- `$schema` URL updated to `https://biomejs.dev/schemas/2.5.1/schema.json`
- `noUndeclaredDependencies` is now suppressed for `**/__test__/**`, `**/*.spec.*`, `**/vitest.config.*`, `**/vitest.setup.*`, `**/vitest.env.*`, `**/vitest.globals.*`, and `**/vite.config.*` — previously only `**/*.test.ts` was covered
- the optional `@biomejs/biome` peer dependency range loosened from an exact `2.4.16` pin to `~2.5.0` (the 2.5 minor line)

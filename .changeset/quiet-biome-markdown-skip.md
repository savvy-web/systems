---
"@savvy-web/silk": patch
---

## Bug Fixes

* The shared Biome config now excludes Markdown files and `pnpm-lock.yaml`. Biome 2.6 formats both by default, which failed `biome check` on every Markdown file (markdownlint already owns them) and on the pnpm-generated lockfile. The exclusion is valid config on Biome 2.5 as well.

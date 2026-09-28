---
"@savvy-web/pnpm-plugin-silk": patch
---

## Features

* `catalog:test` and `catalog:test:peers` now carry `@yarnpkg/cli-dist` (Yarn Berry 4), for harnesses that exercise packages under Yarn and need a pinned Berry rather than whatever `yarn` the host provides.
* `@yarnpkg/cli-dist` is excluded from `minimumReleaseAge`, so a new Berry release is usable right away instead of a day later.

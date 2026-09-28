---
"@savvy-web/pnpm-plugin-silk": patch
---

## Features

* `catalog:test` and `catalog:test:peers` now carry `@yarnpkg/cli-dist` (Yarn Berry 4), for harnesses that exercise packages under Yarn and need a pinned Berry rather than whatever `yarn` the host provides.
* `yarn` and every `@yarnpkg/*` package are excluded from `minimumReleaseAge`, so a new Yarn release is usable right away instead of a day later.

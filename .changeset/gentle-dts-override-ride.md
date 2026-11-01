---
"@savvy-web/pnpm-plugin-silk": minor
---

## Features

Consumers now inherit two new distributed settings. An override pins `tsdown>rolldown-plugin-dts` to `^0.29.0`, because tsdown 0.23.4 narrowed its range to `^0.28.8`, which fails under TypeScript 7.1 with "TypeScript Go is not installed". `effect` and `@effect/*` are also added to `minimumReleaseAgeExclude`, so Effect releases install without waiting out the release-age gate.

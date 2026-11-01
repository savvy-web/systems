---
"@savvy-web/pnpm-plugin-silk": minor
---

## Features

Consumers now inherit two new distributed settings. An override pins `tsdown>rolldown-plugin-dts` to `^0.29.0`, because tsdown 0.23.4 narrowed its range to `^0.28.8`, which fails under TypeScript 7.1 with "TypeScript Go is not installed". `effect` and `@effect/*` are also added to `minimumReleaseAgeExclude`, so Effect releases install without waiting out the release-age gate.

## Maintenance

Catalog updates distributed to consumers:

- `build`: `@rsbuild/core` ^2.3.0, with its `build:peers` floor raised from ^2.2.0 to ^2.3.0.
- `build`: `tsdown`, `@tsdown/css` and `@tsdown/exe` ^0.23.4.
- `build`: `rolldown` ^1.2.16.
- `build`, `docs` and `silk`: `@types/node` ^26.6.6.
- `lint`: `@biomejs/biome` 2.6.4.

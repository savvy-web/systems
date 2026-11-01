---
"@savvy-web/pnpm-plugin-silk": minor
---

## Features

Consumers now inherit two new distributed settings. An override pins `tsdown>rolldown-plugin-dts` to `^0.29.0`, because tsdown 0.23.4 narrowed its range to `^0.28.8`, which fails under TypeScript 7.1 with "TypeScript Go is not installed". `effect` and `@effect/*` are also added to `minimumReleaseAgeExclude`, so Effect releases install without waiting out the release-age gate.

## Maintenance

Catalog updates distributed to consumers:

- `build`: `@microsoft/api-extractor` ^7.60.1 and `@microsoft/api-extractor-model` ^7.33.16 (both catalog and peer ranges). api-extractor 7.60 depends on TypeScript 6.0.3 itself, so the distributed `@microsoft/api-extractor>typescript` override is removed; it would otherwise force TypeScript 6 back onto api-extractor once it supports TypeScript 7. `@microsoft/tsdoc` ~0.17.1 and `@microsoft/tsdoc-config` ~0.18.3 are unchanged.
- `build`: `@rsbuild/core` ^2.3.0, with its `build:peers` floor raised from ^2.2.0 to ^2.3.0.
- `build`: `tsdown`, `@tsdown/css` and `@tsdown/exe` ^0.23.4.
- `build`: `rolldown` ^1.2.16.
- `build`, `docs` and `silk`: `@types/node` ^26.6.6.
- `lint`: `@biomejs/biome` 2.6.4.

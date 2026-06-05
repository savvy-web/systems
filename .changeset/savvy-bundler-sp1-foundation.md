---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

- Add `@savvy-web/tsdown-plugins` and `@savvy-web/bundler` — the SP1 foundation of a tsdown-based replacement for `@savvy-web/rslib-builder`. `@savvy-web/tsdown-plugins` is an interface-only tsdown/rolldown plugin pack: package.json-driven entry detection, manifest transformation and emission, the dts resolved-tsconfig port (tsc-path declarations that survive pnpm symlinks), the per-TargetGroup build loop, and an Effect output reporter with human, agent, and CI modes. `@savvy-web/bundler` adds `defineBuild`/`runBuild` and the self-executing `savvy.build.ts` contract, driving tsdown programmatically. Catalog and `workspace:` resolution is delegated to `workspaces-effect`'s `CatalogResolver`. Both packages are built by `@savvy-web/rslib-builder` until the stack self-hosts.

---
"@savvy-web/pnpm-plugin-silk": minor
---

## Features

- The `build`, `docs` and `silk` catalogs, and their `:peers` companions, now declare TypeScript `^7.1.0-beta` explicitly, locked rather than minor-locked. Consumers resolve the same 7.1 compiler the Silk build toolchain emits declarations with, instead of picking up the beta implicitly through `@savvy-web/silk`'s peer auto-install.

## Bug Fixes

- Added the override `@effected/workspaces@0.38.1>@effected/lockfiles: 0.19.4`. `@effected/lockfiles` 0.19.5 raised its `@effected/npm` peer to `^0.27.0` in a patch, so a graph that still pulls `@effected/workspaces` 0.38.1 (as `@vitest-agent/*` and `rolldown-pnpm-config` do) got lockfiles 0.19.5 over npm 0.26.2, and a root `tsc --noEmit` failed on its declarations (`IntegrityHashStatics`). The override has no effect wherever `@effected/workspaces` 0.38.1 is absent.

## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| typescript | config | updated | ^7.0.2 | ^7.1.0-beta |

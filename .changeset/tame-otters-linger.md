---
"@savvy-web/pnpm-plugin-silk": minor
---

## Features

* Adds `build` catalog entries for `@microsoft/api-extractor` (`^7.59.1`, peer `^7.59.0`), `@microsoft/tsdoc` (`~0.16.0`), and `@microsoft/tsdoc-config` (`~0.18.2`, peer `~0.18.0`), pinned the same way `@tsdown/*` and other build-tooling packages already are. Fixes a version mismatch consumers of `@tsdoctor` were hitting.
* Drops `@vitest-agent/cli` and `@vitest-agent/mcp` from `publicHoistPattern` — `vitest-agent` now ships its own bins, the same pattern `@savvy-web/silk` already uses for `savvy`/`savvy-mcp`.
* Removes several now-unnecessary `peerDependencyRules.allowedVersions` entries: `tsdown>typescript`, the `@typescript-eslint/*>typescript` set, and `eslint-plugin-tsdoc>typescript`.

---
"@savvy-web/pnpm-plugin-silk": patch
---

## Bug Fixes

Forces `@effect/vitest` onto Vitest 5 with a pnpm `overrides` entry. `@effect/vitest` still caps its `vitest` peer at `>=4.1.0 <5.0.0`, so under `autoInstallPeers` pnpm pulled a second, Vitest 4 copy into the graph and hoisted it into the workspace root — repos on the silk Vitest 5 catalogs ran their suites on Vitest 4 without realising it.

The existing `peerDependencyRules.allowedVersions` entry for the same selector cannot do this. pnpm consumes `allowedVersions` in `filterPeerDependencyIssues`, which suppresses the unmet-peer warning and takes no part in resolution.

* Adds `"@effect/vitest>vitest": "^5.0.0"` to `overrides`

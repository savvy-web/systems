---
id: packages/tsdown-plugins/api/function/resolvenextversions
title: "resolveNextVersions — tsdown-plugins function"
summary: "Resolve the next release version of every workspace package from pending changesets. Walks up from `cwd` to the monorepo root via `@manypkg/get-packages`, seed…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# resolveNextVersions

Resolve the next release version of every workspace package from pending changesets. Walks up from `cwd` to the monorepo root via `@manypkg/get-packages`, seeds the map with each package's CURRENT version, then overlays `newVersion` for changeset-affected packages via `@changesets/get-release-plan`. Never rejects: any failure (not a workspace, missing `.changeset/config.json`, parse error) degrades to current versions (or an empty map).

```ts
function resolveNextVersions(cwd: string): Promise<NextVersions>;
```

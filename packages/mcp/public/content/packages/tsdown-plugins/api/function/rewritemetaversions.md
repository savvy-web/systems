---
id: packages/tsdown-plugins/api/function/rewritemetaversions
title: "rewriteMetaVersions — tsdown-plugins function"
summary: "Rewrite a meta `package.json` so the package's own `version` and any workspace-sibling dependency version reflect their NEXT release version from `versions`. P…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# rewriteMetaVersions

Rewrite a meta `package.json` so the package's own `version` and any workspace-sibling dependency version reflect their NEXT release version from `versions`. Pure: returns a new object, never mutates the input. External/catalog-resolved deps (names absent from `versions`) are left as-is.

```ts
function rewriteMetaVersions(pkg: Record<string, unknown>, versions: ReadonlyMap<string, string>, selfName: string): Record<string, unknown>;
```

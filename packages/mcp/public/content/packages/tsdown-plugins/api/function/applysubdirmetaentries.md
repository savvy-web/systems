---
id: packages/tsdown-plugins/api/function/applysubdirmetaentries
title: "applySubdirMetaEntries — tsdown-plugins function"
summary: "For each `outSubdir` override, point its meta entry at the isolated sub-package barrel."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# applySubdirMetaEntries

For each `outSubdir` override, point its meta entry at the isolated sub-package barrel.

```ts
function applySubdirMetaEntries(overrides: ReadonlyArray<{
  entries: ReadonlyArray<string>;
  outSubdir?: string | undefined;
}> | undefined, dtsBasenames: Record<string, string>, exportPaths: Record<string, string>): void;
```

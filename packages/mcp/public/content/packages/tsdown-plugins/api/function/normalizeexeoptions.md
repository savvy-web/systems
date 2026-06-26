---
id: packages/tsdown-plugins/api/function/normalizeexeoptions
title: "normalizeExeOptions — tsdown-plugins function"
summary: "Normalize `exe` (object or array) into one fully-resolved spec per binary. Pure function; structural validation (missing fileName, empty targets) lives in the…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# normalizeExeOptions

Normalize `exe` (object or array) into one fully-resolved spec per binary. Pure function; structural validation (missing fileName, empty targets) lives in the config-validation layer.

```ts
function normalizeExeOptions(exe: ExeConfig | ReadonlyArray<ExeConfig>, pkg: PkgOsCpu): ReadonlyArray<NormalizedExe>;
```

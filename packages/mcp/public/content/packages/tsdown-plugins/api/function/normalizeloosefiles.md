---
id: packages/tsdown-plugins/api/function/normalizeloosefiles
title: "normalizeLooseFiles — tsdown-plugins function"
summary: "Resolve a `looseFiles` map into normalized build descriptors. Pure (no filesystem): a missing `source` is surfaced later by tsdown's entry resolution. Throws C…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# normalizeLooseFiles

Resolve a `looseFiles` map into normalized build descriptors. Pure (no filesystem): a missing `source` is surfaced later by tsdown's entry resolution. Throws [ConfigValidationError](silk://packages/tsdown-plugins/api/class/configvalidationerror) on any structural problem so the bundler's [ConfigValidator](silk://packages/tsdown-plugins/api/class/configvalidator) surfaces it as a typed, fast-fail config error.

```ts
function normalizeLooseFiles(files: LooseFiles): ReadonlyArray<NormalizedLooseFile>;
```

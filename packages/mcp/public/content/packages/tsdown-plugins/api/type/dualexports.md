---
id: packages/tsdown-plugins/api/type/dualexports
title: "DualExports — tsdown-plugins type"
summary: "Which exports get a CJS `require` condition. `true`/`false` apply uniformly to every TS export; a Set marks ONLY the listed export keys (e.g. \"./changesets/mar…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# DualExports

Which exports get a CJS `require` condition. `true`/`false` apply uniformly to every TS export; a Set marks ONLY the listed export keys (e.g. "./changesets/markdownlint") as dual — used by per-entry format overrides.

```ts
type DualExports = boolean | ReadonlySet<string>;
```

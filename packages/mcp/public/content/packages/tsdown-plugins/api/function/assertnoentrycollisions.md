---
id: packages/tsdown-plugins/api/function/assertnoentrycollisions
title: "assertNoEntryCollisions — tsdown-plugins function"
summary: "Throw ConfigValidationError if any ambient output name collides with a JS build-entry name. The JS entry names carry no extension, so each ambient `outName` is…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# assertNoEntryCollisions

Throw [ConfigValidationError](silk://packages/tsdown-plugins/api/class/configvalidationerror) if any ambient output name collides with a JS build-entry name. The JS entry names carry no extension, so each ambient `outName` is compared with its declaration extension stripped.

```ts
function assertNoEntryCollisions(jsEntryNames: ReadonlyArray<string>, ambient: ReadonlyArray<AmbientDtsEntry>): void;
```

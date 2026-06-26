---
id: packages/tsdown-plugins/api/function/runmetapass
title: "runMetaPass — tsdown-plugins function"
summary: "Meta-pass orchestrator: derives export paths, filters bin/ entries, resolves optimistic next-versions, and calls generateMeta once per publish group."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# runMetaPass

Meta-pass orchestrator: derives export paths, filters bin/ entries, resolves optimistic next-versions, and calls [generateMeta](silk://packages/tsdown-plugins/api/function/generatemeta) once per publish group.

```ts
function runMetaPass(o: RunMetaPassOptions): Promise<void>;
```

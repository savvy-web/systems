---
id: packages/github-action-builder/api/variable/workerentrymissingbase
title: "WorkerEntryMissingBase — github-action-builder variable"
summary: "Base class for WorkerEntryMissing error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# WorkerEntryMissingBase

Base class for [WorkerEntryMissing](silk://packages/github-action-builder/api/class/workerentrymissing) error.

```ts
WorkerEntryMissingBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "WorkerEntryMissing";
} & Readonly<A>
```

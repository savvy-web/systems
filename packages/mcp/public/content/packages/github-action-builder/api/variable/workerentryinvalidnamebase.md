---
id: packages/github-action-builder/api/variable/workerentryinvalidnamebase
title: "WorkerEntryInvalidNameBase — github-action-builder variable"
summary: "Base class for WorkerEntryInvalidName error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# WorkerEntryInvalidNameBase

Base class for [WorkerEntryInvalidName](silk://packages/github-action-builder/api/class/workerentryinvalidname) error.

```ts
WorkerEntryInvalidNameBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "WorkerEntryInvalidName";
} & Readonly<A>
```

---
id: packages/github-action-builder/api/variable/persistlocalerrorbase
title: "PersistLocalErrorBase — github-action-builder variable"
summary: "Base class for PersistLocalError error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# PersistLocalErrorBase

Base class for [PersistLocalError](silk://packages/github-action-builder/api/class/persistlocalerror) error.

```ts
PersistLocalErrorBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "PersistLocalError";
} & Readonly<A>
```

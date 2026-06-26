---
id: packages/github-action-builder/api/variable/writeerrorbase
title: "WriteErrorBase — github-action-builder variable"
summary: "Base class for WriteError error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# WriteErrorBase

Base class for [WriteError](silk://packages/github-action-builder/api/class/writeerror) error.

```ts
WriteErrorBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "WriteError";
} & Readonly<A>
```

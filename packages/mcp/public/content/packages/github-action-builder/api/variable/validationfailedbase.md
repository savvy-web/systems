---
id: packages/github-action-builder/api/variable/validationfailedbase
title: "ValidationFailedBase — github-action-builder variable"
summary: "Base class for ValidationFailed error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidationFailedBase

Base class for [ValidationFailed](silk://packages/github-action-builder/api/class/validationfailed) error.

```ts
ValidationFailedBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "ValidationFailed";
} & Readonly<A>
```

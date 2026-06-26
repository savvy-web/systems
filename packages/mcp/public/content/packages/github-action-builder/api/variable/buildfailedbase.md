---
id: packages/github-action-builder/api/variable/buildfailedbase
title: "BuildFailedBase — github-action-builder variable"
summary: "Base class for BuildFailed error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BuildFailedBase

Base class for [BuildFailed](silk://packages/github-action-builder/api/class/buildfailed) error.

```ts
BuildFailedBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "BuildFailed";
} & Readonly<A>
```

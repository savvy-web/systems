---
id: packages/github-action-builder/api/variable/bundlefailedbase
title: "BundleFailedBase — github-action-builder variable"
summary: "Base class for BundleFailed error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BundleFailedBase

Base class for [BundleFailed](silk://packages/github-action-builder/api/class/bundlefailed) error.

```ts
BundleFailedBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "BundleFailed";
} & Readonly<A>
```

---
id: packages/github-action-builder/api/variable/configloadfailedbase
title: "ConfigLoadFailedBase — github-action-builder variable"
summary: "Base class for ConfigLoadFailed error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigLoadFailedBase

Base class for [ConfigLoadFailed](silk://packages/github-action-builder/api/class/configloadfailed) error.

```ts
ConfigLoadFailedBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "ConfigLoadFailed";
} & Readonly<A>
```

---
id: packages/github-action-builder/api/variable/confignotfoundbase
title: "ConfigNotFoundBase — github-action-builder variable"
summary: "Base class for ConfigNotFound error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigNotFoundBase

Base class for [ConfigNotFound](silk://packages/github-action-builder/api/class/confignotfound) error.

```ts
ConfigNotFoundBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "ConfigNotFound";
} & Readonly<A>
```

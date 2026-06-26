---
id: packages/github-action-builder/api/variable/configinvalidbase
title: "ConfigInvalidBase — github-action-builder variable"
summary: "Base class for ConfigInvalid error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigInvalidBase

Base class for [ConfigInvalid](silk://packages/github-action-builder/api/class/configinvalid) error.

```ts
ConfigInvalidBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "ConfigInvalid";
} & Readonly<A>
```

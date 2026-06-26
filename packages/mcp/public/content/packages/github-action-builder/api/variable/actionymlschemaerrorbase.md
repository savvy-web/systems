---
id: packages/github-action-builder/api/variable/actionymlschemaerrorbase
title: "ActionYmlSchemaErrorBase — github-action-builder variable"
summary: "Base class for ActionYmlSchemaError error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ActionYmlSchemaErrorBase

Base class for [ActionYmlSchemaError](silk://packages/github-action-builder/api/class/actionymlschemaerror) error.

```ts
ActionYmlSchemaErrorBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "ActionYmlSchemaError";
} & Readonly<A>
```

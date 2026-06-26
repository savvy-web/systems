---
id: packages/github-action-builder/api/variable/actionymlpatherrorbase
title: "ActionYmlPathErrorBase — github-action-builder variable"
summary: "Base class for ActionYmlPathError error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ActionYmlPathErrorBase

Base class for [ActionYmlPathError](silk://packages/github-action-builder/api/class/actionymlpatherror) error.

```ts
ActionYmlPathErrorBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "ActionYmlPathError";
} & Readonly<A>
```

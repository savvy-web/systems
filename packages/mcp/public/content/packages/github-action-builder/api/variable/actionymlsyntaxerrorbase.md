---
id: packages/github-action-builder/api/variable/actionymlsyntaxerrorbase
title: "ActionYmlSyntaxErrorBase — github-action-builder variable"
summary: "Base class for ActionYmlSyntaxError error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ActionYmlSyntaxErrorBase

Base class for [ActionYmlSyntaxError](silk://packages/github-action-builder/api/class/actionymlsyntaxerror) error.

```ts
ActionYmlSyntaxErrorBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "ActionYmlSyntaxError";
} & Readonly<A>
```

---
id: packages/github-action-builder/api/variable/actionymlmissingbase
title: "ActionYmlMissingBase — github-action-builder variable"
summary: "Base class for ActionYmlMissing error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ActionYmlMissingBase

Base class for [ActionYmlMissing](silk://packages/github-action-builder/api/class/actionymlmissing) error.

```ts
ActionYmlMissingBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "ActionYmlMissing";
} & Readonly<A>
```

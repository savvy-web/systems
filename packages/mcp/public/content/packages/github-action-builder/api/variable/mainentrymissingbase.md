---
id: packages/github-action-builder/api/variable/mainentrymissingbase
title: "MainEntryMissingBase — github-action-builder variable"
summary: "Base class for MainEntryMissing error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# MainEntryMissingBase

Base class for [MainEntryMissing](silk://packages/github-action-builder/api/class/mainentrymissing) error.

```ts
MainEntryMissingBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "MainEntryMissing";
} & Readonly<A>
```

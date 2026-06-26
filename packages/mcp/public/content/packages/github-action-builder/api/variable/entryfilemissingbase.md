---
id: packages/github-action-builder/api/variable/entryfilemissingbase
title: "EntryFileMissingBase — github-action-builder variable"
summary: "Base class for EntryFileMissing error."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# EntryFileMissingBase

Base class for [EntryFileMissing](silk://packages/github-action-builder/api/class/entryfilemissing) error.

```ts
EntryFileMissingBase: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => import("effect/Cause").YieldableError & {
  readonly _tag: "EntryFileMissing";
} & Readonly<A>
```

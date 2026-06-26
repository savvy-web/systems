---
id: packages/silk-effects/api/variable/syncresult
title: "SyncResult — silk-effects variable"
summary: "variable SyncResult from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SyncResult

```ts
SyncResult: {
  readonly $is: <Tag extends "Created" | "Unchanged" | "Updated">(tag: Tag) => (u: unknown) => u is Extract<{
    readonly _tag: "Created";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "Unchanged";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "Updated";
    readonly diff: SectionDiff;
  }, {
    readonly _tag: Tag;
  }>;
  readonly $match: {
    <const Cases extends {
      readonly Created: (args: {
        readonly _tag: "Created";
      }) => any;
      readonly Unchanged: (args: {
        readonly _tag: "Unchanged";
      }) => any;
      readonly Updated: (args: {
        readonly _tag: "Updated";
        readonly diff: SectionDiff;
      }) => any;
    }>(cases: Cases & { [K in Exclude<keyof Cases, "Created" | "Unchanged" | "Updated">]: never }): (value: {
      readonly _tag: "Created";
    } | {
      readonly _tag: "Unchanged";
    } | {
      readonly _tag: "Updated";
      readonly diff: SectionDiff;
    }) => import("effect/Unify").Unify<ReturnType<Cases["Created" | "Unchanged" | "Updated"]>>;
    <const Cases extends {
      readonly Created: (args: {
        readonly _tag: "Created";
      }) => any;
      readonly Unchanged: (args: {
        readonly _tag: "Unchanged";
      }) => any;
      readonly Updated: (args: {
        readonly _tag: "Updated";
        readonly diff: SectionDiff;
      }) => any;
    }>(value: {
      readonly _tag: "Created";
    } | {
      readonly _tag: "Unchanged";
    } | {
      readonly _tag: "Updated";
      readonly diff: SectionDiff;
    }, cases: Cases & { [K in Exclude<keyof Cases, "Created" | "Unchanged" | "Updated">]: never }): import("effect/Unify").Unify<ReturnType<Cases["Created" | "Unchanged" | "Updated"]>>;
  };
  readonly Created: Data.Case.Constructor<{
    readonly _tag: "Created";
  }, "_tag">;
  readonly Unchanged: Data.Case.Constructor<{
    readonly _tag: "Unchanged";
  }, "_tag">;
  readonly Updated: Data.Case.Constructor<{
    readonly _tag: "Updated";
    readonly diff: SectionDiff;
  }, "_tag">;
}
```

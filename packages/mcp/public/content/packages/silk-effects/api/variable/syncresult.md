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
  readonly Created: Data.Case.Constructor<{
    readonly _tag: "Created";
  }, "_tag">;
  readonly Updated: Data.Case.Constructor<{
    readonly _tag: "Updated";
    readonly diff: SectionDiff;
  }, "_tag">;
  readonly Unchanged: Data.Case.Constructor<{
    readonly _tag: "Unchanged";
  }, "_tag">;
  readonly $is: <Tag extends "Created" | "Updated" | "Unchanged">(tag: Tag) => (u: unknown) => u is Extract<{
    readonly _tag: "Created";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "Updated";
    readonly diff: SectionDiff;
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "Unchanged";
  }, {
    readonly _tag: Tag;
  }>;
  readonly $match: {
    <const Cases extends {
      readonly Created: (args: {
        readonly _tag: "Created";
      }) => any;
      readonly Updated: (args: {
        readonly _tag: "Updated";
        readonly diff: SectionDiff;
      }) => any;
      readonly Unchanged: (args: {
        readonly _tag: "Unchanged";
      }) => any;
    }>(cases: Cases & { [K in Exclude<keyof Cases, "Created" | "Updated" | "Unchanged">]: never }): (value: {
      readonly _tag: "Created";
    } | {
      readonly _tag: "Updated";
      readonly diff: SectionDiff;
    } | {
      readonly _tag: "Unchanged";
    }) => import("effect/Unify").Unify<ReturnType<Cases["Created" | "Updated" | "Unchanged"]>>;
    <const Cases extends {
      readonly Created: (args: {
        readonly _tag: "Created";
      }) => any;
      readonly Updated: (args: {
        readonly _tag: "Updated";
        readonly diff: SectionDiff;
      }) => any;
      readonly Unchanged: (args: {
        readonly _tag: "Unchanged";
      }) => any;
    }>(value: {
      readonly _tag: "Created";
    } | {
      readonly _tag: "Updated";
      readonly diff: SectionDiff;
    } | {
      readonly _tag: "Unchanged";
    }, cases: Cases & { [K in Exclude<keyof Cases, "Created" | "Updated" | "Unchanged">]: never }): import("effect/Unify").Unify<ReturnType<Cases["Created" | "Updated" | "Unchanged"]>>;
  };
}
```

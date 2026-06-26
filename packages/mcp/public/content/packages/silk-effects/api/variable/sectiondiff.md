---
id: packages/silk-effects/api/variable/sectiondiff
title: "SectionDiff — silk-effects variable"
summary: "variable SectionDiff from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SectionDiff

```ts
SectionDiff: {
  readonly Unchanged: Data.Case.Constructor<{
    readonly _tag: "Unchanged";
  }, "_tag">;
  readonly Changed: Data.Case.Constructor<{
    readonly _tag: "Changed";
    readonly added: ReadonlyArray<string>;
    readonly removed: ReadonlyArray<string>;
  }, "_tag">;
  readonly $is: <Tag extends "Unchanged" | "Changed">(tag: Tag) => (u: unknown) => u is Extract<{
    readonly _tag: "Unchanged";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "Changed";
    readonly added: ReadonlyArray<string>;
    readonly removed: ReadonlyArray<string>;
  }, {
    readonly _tag: Tag;
  }>;
  readonly $match: {
    <const Cases extends {
      readonly Unchanged: (args: {
        readonly _tag: "Unchanged";
      }) => any;
      readonly Changed: (args: {
        readonly _tag: "Changed";
        readonly added: ReadonlyArray<string>;
        readonly removed: ReadonlyArray<string>;
      }) => any;
    }>(cases: Cases & { [K in Exclude<keyof Cases, "Unchanged" | "Changed">]: never }): (value: {
      readonly _tag: "Unchanged";
    } | {
      readonly _tag: "Changed";
      readonly added: ReadonlyArray<string>;
      readonly removed: ReadonlyArray<string>;
    }) => import("effect/Unify").Unify<ReturnType<Cases["Unchanged" | "Changed"]>>;
    <const Cases extends {
      readonly Unchanged: (args: {
        readonly _tag: "Unchanged";
      }) => any;
      readonly Changed: (args: {
        readonly _tag: "Changed";
        readonly added: ReadonlyArray<string>;
        readonly removed: ReadonlyArray<string>;
      }) => any;
    }>(value: {
      readonly _tag: "Unchanged";
    } | {
      readonly _tag: "Changed";
      readonly added: ReadonlyArray<string>;
      readonly removed: ReadonlyArray<string>;
    }, cases: Cases & { [K in Exclude<keyof Cases, "Unchanged" | "Changed">]: never }): import("effect/Unify").Unify<ReturnType<Cases["Unchanged" | "Changed"]>>;
  };
}
```

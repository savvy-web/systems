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
  readonly $is: <Tag extends "Changed" | "Unchanged">(tag: Tag) => (u: unknown) => u is Extract<{
    readonly _tag: "Changed";
    readonly added: ReadonlyArray<string>;
    readonly removed: ReadonlyArray<string>;
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "Unchanged";
  }, {
    readonly _tag: Tag;
  }>;
  readonly $match: {
    <const Cases extends {
      readonly Changed: (args: {
        readonly _tag: "Changed";
        readonly added: ReadonlyArray<string>;
        readonly removed: ReadonlyArray<string>;
      }) => any;
      readonly Unchanged: (args: {
        readonly _tag: "Unchanged";
      }) => any;
    }>(cases: Cases & { [K in Exclude<keyof Cases, "Changed" | "Unchanged">]: never }): (value: {
      readonly _tag: "Changed";
      readonly added: ReadonlyArray<string>;
      readonly removed: ReadonlyArray<string>;
    } | {
      readonly _tag: "Unchanged";
    }) => import("effect/Unify").Unify<ReturnType<Cases["Changed" | "Unchanged"]>>;
    <const Cases extends {
      readonly Changed: (args: {
        readonly _tag: "Changed";
        readonly added: ReadonlyArray<string>;
        readonly removed: ReadonlyArray<string>;
      }) => any;
      readonly Unchanged: (args: {
        readonly _tag: "Unchanged";
      }) => any;
    }>(value: {
      readonly _tag: "Changed";
      readonly added: ReadonlyArray<string>;
      readonly removed: ReadonlyArray<string>;
    } | {
      readonly _tag: "Unchanged";
    }, cases: Cases & { [K in Exclude<keyof Cases, "Changed" | "Unchanged">]: never }): import("effect/Unify").Unify<ReturnType<Cases["Changed" | "Unchanged"]>>;
  };
  readonly Changed: Data.Case.Constructor<{
    readonly _tag: "Changed";
    readonly added: ReadonlyArray<string>;
    readonly removed: ReadonlyArray<string>;
  }, "_tag">;
  readonly Unchanged: Data.Case.Constructor<{
    readonly _tag: "Unchanged";
  }, "_tag">;
}
```

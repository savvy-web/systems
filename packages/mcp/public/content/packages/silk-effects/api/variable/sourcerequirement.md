---
id: packages/silk-effects/api/variable/sourcerequirement
title: "SourceRequirement — silk-effects variable"
summary: "variable SourceRequirement from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SourceRequirement

```ts
SourceRequirement: {
  readonly Any: Data.Case.Constructor<{
    readonly _tag: "Any";
  }, "_tag">;
  readonly OnlyLocal: Data.Case.Constructor<{
    readonly _tag: "OnlyLocal";
  }, "_tag">;
  readonly OnlyGlobal: Data.Case.Constructor<{
    readonly _tag: "OnlyGlobal";
  }, "_tag">;
  readonly Both: Data.Case.Constructor<{
    readonly _tag: "Both";
  }, "_tag">;
  readonly $is: <Tag extends "Any" | "OnlyLocal" | "OnlyGlobal" | "Both">(tag: Tag) => (u: unknown) => u is Extract<{
    readonly _tag: "Any";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "OnlyLocal";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "OnlyGlobal";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "Both";
  }, {
    readonly _tag: Tag;
  }>;
  readonly $match: {
    <const Cases extends {
      readonly Any: (args: {
        readonly _tag: "Any";
      }) => any;
      readonly OnlyLocal: (args: {
        readonly _tag: "OnlyLocal";
      }) => any;
      readonly OnlyGlobal: (args: {
        readonly _tag: "OnlyGlobal";
      }) => any;
      readonly Both: (args: {
        readonly _tag: "Both";
      }) => any;
    }>(cases: Cases & { [K in Exclude<keyof Cases, "Any" | "OnlyLocal" | "OnlyGlobal" | "Both">]: never }): (value: {
      readonly _tag: "Any";
    } | {
      readonly _tag: "OnlyLocal";
    } | {
      readonly _tag: "OnlyGlobal";
    } | {
      readonly _tag: "Both";
    }) => import("effect/Unify").Unify<ReturnType<Cases["Any" | "OnlyLocal" | "OnlyGlobal" | "Both"]>>;
    <const Cases extends {
      readonly Any: (args: {
        readonly _tag: "Any";
      }) => any;
      readonly OnlyLocal: (args: {
        readonly _tag: "OnlyLocal";
      }) => any;
      readonly OnlyGlobal: (args: {
        readonly _tag: "OnlyGlobal";
      }) => any;
      readonly Both: (args: {
        readonly _tag: "Both";
      }) => any;
    }>(value: {
      readonly _tag: "Any";
    } | {
      readonly _tag: "OnlyLocal";
    } | {
      readonly _tag: "OnlyGlobal";
    } | {
      readonly _tag: "Both";
    }, cases: Cases & { [K in Exclude<keyof Cases, "Any" | "OnlyLocal" | "OnlyGlobal" | "Both">]: never }): import("effect/Unify").Unify<ReturnType<Cases["Any" | "OnlyLocal" | "OnlyGlobal" | "Both"]>>;
  };
}
```

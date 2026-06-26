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
  readonly $is: <Tag extends "Any" | "Both" | "OnlyGlobal" | "OnlyLocal">(tag: Tag) => (u: unknown) => u is Extract<{
    readonly _tag: "Any";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "Both";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "OnlyGlobal";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "OnlyLocal";
  }, {
    readonly _tag: Tag;
  }>;
  readonly $match: {
    <const Cases extends {
      readonly Any: (args: {
        readonly _tag: "Any";
      }) => any;
      readonly Both: (args: {
        readonly _tag: "Both";
      }) => any;
      readonly OnlyGlobal: (args: {
        readonly _tag: "OnlyGlobal";
      }) => any;
      readonly OnlyLocal: (args: {
        readonly _tag: "OnlyLocal";
      }) => any;
    }>(cases: Cases & { [K in Exclude<keyof Cases, "Any" | "Both" | "OnlyGlobal" | "OnlyLocal">]: never }): (value: {
      readonly _tag: "Any";
    } | {
      readonly _tag: "Both";
    } | {
      readonly _tag: "OnlyGlobal";
    } | {
      readonly _tag: "OnlyLocal";
    }) => import("effect/Unify").Unify<ReturnType<Cases["Any" | "Both" | "OnlyGlobal" | "OnlyLocal"]>>;
    <const Cases extends {
      readonly Any: (args: {
        readonly _tag: "Any";
      }) => any;
      readonly Both: (args: {
        readonly _tag: "Both";
      }) => any;
      readonly OnlyGlobal: (args: {
        readonly _tag: "OnlyGlobal";
      }) => any;
      readonly OnlyLocal: (args: {
        readonly _tag: "OnlyLocal";
      }) => any;
    }>(value: {
      readonly _tag: "Any";
    } | {
      readonly _tag: "Both";
    } | {
      readonly _tag: "OnlyGlobal";
    } | {
      readonly _tag: "OnlyLocal";
    }, cases: Cases & { [K in Exclude<keyof Cases, "Any" | "Both" | "OnlyGlobal" | "OnlyLocal">]: never }): import("effect/Unify").Unify<ReturnType<Cases["Any" | "Both" | "OnlyGlobal" | "OnlyLocal"]>>;
  };
  readonly Any: Data.Case.Constructor<{
    readonly _tag: "Any";
  }, "_tag">;
  readonly Both: Data.Case.Constructor<{
    readonly _tag: "Both";
  }, "_tag">;
  readonly OnlyGlobal: Data.Case.Constructor<{
    readonly _tag: "OnlyGlobal";
  }, "_tag">;
  readonly OnlyLocal: Data.Case.Constructor<{
    readonly _tag: "OnlyLocal";
  }, "_tag">;
}
```

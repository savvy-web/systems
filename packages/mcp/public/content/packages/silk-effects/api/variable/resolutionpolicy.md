---
id: packages/silk-effects/api/variable/resolutionpolicy
title: "ResolutionPolicy — silk-effects variable"
summary: "variable ResolutionPolicy from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ResolutionPolicy

```ts
ResolutionPolicy: {
  readonly Report: Data.Case.Constructor<{
    readonly _tag: "Report";
  }, "_tag">;
  readonly PreferLocal: Data.Case.Constructor<{
    readonly _tag: "PreferLocal";
  }, "_tag">;
  readonly PreferGlobal: Data.Case.Constructor<{
    readonly _tag: "PreferGlobal";
  }, "_tag">;
  readonly RequireMatch: Data.Case.Constructor<{
    readonly _tag: "RequireMatch";
  }, "_tag">;
  readonly $is: <Tag extends "Report" | "PreferLocal" | "PreferGlobal" | "RequireMatch">(tag: Tag) => (u: unknown) => u is Extract<{
    readonly _tag: "Report";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "PreferLocal";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "PreferGlobal";
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "RequireMatch";
  }, {
    readonly _tag: Tag;
  }>;
  readonly $match: {
    <const Cases extends {
      readonly Report: (args: {
        readonly _tag: "Report";
      }) => any;
      readonly PreferLocal: (args: {
        readonly _tag: "PreferLocal";
      }) => any;
      readonly PreferGlobal: (args: {
        readonly _tag: "PreferGlobal";
      }) => any;
      readonly RequireMatch: (args: {
        readonly _tag: "RequireMatch";
      }) => any;
    }>(cases: Cases & { [K in Exclude<keyof Cases, "Report" | "PreferLocal" | "PreferGlobal" | "RequireMatch">]: never }): (value: {
      readonly _tag: "Report";
    } | {
      readonly _tag: "PreferLocal";
    } | {
      readonly _tag: "PreferGlobal";
    } | {
      readonly _tag: "RequireMatch";
    }) => import("effect/Unify").Unify<ReturnType<Cases["Report" | "PreferLocal" | "PreferGlobal" | "RequireMatch"]>>;
    <const Cases extends {
      readonly Report: (args: {
        readonly _tag: "Report";
      }) => any;
      readonly PreferLocal: (args: {
        readonly _tag: "PreferLocal";
      }) => any;
      readonly PreferGlobal: (args: {
        readonly _tag: "PreferGlobal";
      }) => any;
      readonly RequireMatch: (args: {
        readonly _tag: "RequireMatch";
      }) => any;
    }>(value: {
      readonly _tag: "Report";
    } | {
      readonly _tag: "PreferLocal";
    } | {
      readonly _tag: "PreferGlobal";
    } | {
      readonly _tag: "RequireMatch";
    }, cases: Cases & { [K in Exclude<keyof Cases, "Report" | "PreferLocal" | "PreferGlobal" | "RequireMatch">]: never }): import("effect/Unify").Unify<ReturnType<Cases["Report" | "PreferLocal" | "PreferGlobal" | "RequireMatch"]>>;
  };
}
```

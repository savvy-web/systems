---
id: packages/silk-effects/api/variable/checkresult
title: "CheckResult — silk-effects variable"
summary: "variable CheckResult from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# CheckResult

```ts
CheckResult: {
  readonly Found: Data.Case.Constructor<{
    readonly _tag: "Found";
    readonly isUpToDate: boolean;
    readonly diff: SectionDiff;
  }, "_tag">;
  readonly NotFound: Data.Case.Constructor<{
    readonly _tag: "NotFound";
  }, "_tag">;
  readonly $is: <Tag extends "Found" | "NotFound">(tag: Tag) => (u: unknown) => u is Extract<{
    readonly _tag: "Found";
    readonly isUpToDate: boolean;
    readonly diff: SectionDiff;
  }, {
    readonly _tag: Tag;
  }> | Extract<{
    readonly _tag: "NotFound";
  }, {
    readonly _tag: Tag;
  }>;
  readonly $match: {
    <const Cases extends {
      readonly Found: (args: {
        readonly _tag: "Found";
        readonly isUpToDate: boolean;
        readonly diff: SectionDiff;
      }) => any;
      readonly NotFound: (args: {
        readonly _tag: "NotFound";
      }) => any;
    }>(cases: Cases & { [K in Exclude<keyof Cases, "Found" | "NotFound">]: never }): (value: {
      readonly _tag: "Found";
      readonly isUpToDate: boolean;
      readonly diff: SectionDiff;
    } | {
      readonly _tag: "NotFound";
    }) => import("effect/Unify").Unify<ReturnType<Cases["Found" | "NotFound"]>>;
    <const Cases extends {
      readonly Found: (args: {
        readonly _tag: "Found";
        readonly isUpToDate: boolean;
        readonly diff: SectionDiff;
      }) => any;
      readonly NotFound: (args: {
        readonly _tag: "NotFound";
      }) => any;
    }>(value: {
      readonly _tag: "Found";
      readonly isUpToDate: boolean;
      readonly diff: SectionDiff;
    } | {
      readonly _tag: "NotFound";
    }, cases: Cases & { [K in Exclude<keyof Cases, "Found" | "NotFound">]: never }): import("effect/Unify").Unify<ReturnType<Cases["Found" | "NotFound"]>>;
  };
}
```

---
id: packages/silk-effects/api/variable/versionextractor
title: "VersionExtractor — silk-effects variable"
summary: "variable VersionExtractor from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# VersionExtractor

```ts
VersionExtractor: {
    readonly $is: <Tag extends "Flag" | "Json" | "None">(tag: Tag) => (u: unknown) => u is Extract<{
        readonly _tag: "Flag";
        readonly flag: string;
        readonly parse?: ((output: string) => string) | undefined;
    }, {
        readonly _tag: Tag;
    }> | Extract<{
        readonly _tag: "Json";
        readonly flag: string;
        readonly path: string;
    }, {
        readonly _tag: Tag;
    }> | Extract<{
        readonly _tag: "None";
    }, {
        readonly _tag: Tag;
    }>;
    readonly $match: {
        <const Cases extends { readonly [Tag in "Flag" | "Json" | "None"]: (args: Extract<{
            readonly _tag: "Flag";
            readonly flag: string;
            readonly parse?: ((output: string) => string) | undefined;
        }, {
            readonly _tag: Tag;
        }> | Extract<{
            readonly _tag: "Json";
            readonly flag: string;
            readonly path: string;
        }, {
            readonly _tag: Tag;
        }> | Extract<{
            readonly _tag: "None";
        }, {
            readonly _tag: Tag;
        }>) => any; }>(cases: Cases & { [K in Exclude<keyof Cases, "Flag" | "Json" | "None">]: never; }): (value: {
            readonly _tag: "Flag";
            readonly flag: string;
            readonly parse?: ((output: string) => string) | undefined;
        } | {
            readonly _tag: "Json";
            readonly flag: string;
            readonly path: string;
        } | {
            readonly _tag: "None";
        }) => import("effect/Unify").Unify<ReturnType<Cases["Flag" | "Json" | "None"]>>;
        <const Cases extends { readonly [Tag in "Flag" | "Json" | "None"]: (args: Extract<{
            readonly _tag: "Flag";
            readonly flag: string;
            readonly parse?: ((output: string) => string) | undefined;
        }, {
            readonly _tag: Tag;
        }> | Extract<{
            readonly _tag: "Json";
            readonly flag: string;
            readonly path: string;
        }, {
            readonly _tag: Tag;
        }> | Extract<{
            readonly _tag: "None";
        }, {
            readonly _tag: Tag;
        }>) => any; }>(value: {
            readonly _tag: "Flag";
            readonly flag: string;
            readonly parse?: ((output: string) => string) | undefined;
        } | {
            readonly _tag: "Json";
            readonly flag: string;
            readonly path: string;
        } | {
            readonly _tag: "None";
        }, cases: Cases & { [K in Exclude<keyof Cases, "Flag" | "Json" | "None">]: never; }): import("effect/Unify").Unify<ReturnType<Cases["Flag" | "Json" | "None"]>>;
    };
    readonly Flag: Data.Case.Constructor<{
        readonly _tag: "Flag";
        readonly flag: string;
        readonly parse?: ((output: string) => string) | undefined;
    }, "_tag">;
    readonly Json: Data.Case.Constructor<{
        readonly _tag: "Json";
        readonly flag: string;
        readonly path: string;
    }, "_tag">;
    readonly None: Data.Case.Constructor<{
        readonly _tag: "None";
    }, "_tag">;
}
```

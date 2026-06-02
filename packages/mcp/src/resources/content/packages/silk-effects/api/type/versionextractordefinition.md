---
id: packages/silk-effects/api/type/versionextractordefinition
title: "VersionExtractorDefinition — silk-effects type"
summary: "How to extract a version string from a CLI tool."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# VersionExtractorDefinition

How to extract a version string from a CLI tool.

```ts
type VersionExtractorDefinition = {
    readonly Flag: {
        readonly flag: string;
        readonly parse?: ((output: string) => string) | undefined;
    };
    readonly Json: {
        readonly flag: string;
        readonly path: string;
    };
    readonly None: {};
};
```

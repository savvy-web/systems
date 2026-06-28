---
id: packages/tsdown-plugins/api/type/dtsexportclass
title: "DtsExportClass — tsdown-plugins type"
summary: "Classification of a single export value for ambient-.d.ts handling."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# DtsExportClass

Classification of a single export value for ambient-.d.ts handling.

```ts
type DtsExportClass = {
  readonly kind: "ambient";
  readonly source: string;
} | {
  readonly kind: "mixed";
} | {
  readonly kind: "none";
};
```

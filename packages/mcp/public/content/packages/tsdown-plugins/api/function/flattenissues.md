---
id: packages/tsdown-plugins/api/function/flattenissues
title: "flattenIssues — tsdown-plugins function"
summary: "Flatten a build snapshot into the aggregated, de-duplicated issues artifact. Pure."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# flattenIssues

Flatten a build snapshot into the aggregated, de-duplicated issues artifact. Pure.

```ts
function flattenIssues(reports: ReadonlyArray<BuildReport>, opts: {
  target: "dev" | "prod";
  generatedAt: string;
}): BuildIssues;
```

---
id: packages/github-action-effects/api/variable/reportbuilder
title: "ReportBuilder — github-action-effects variable"
summary: "Namespace for composing markdown reports with a fluent builder API."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ReportBuilder

Namespace for composing markdown reports with a fluent builder API.

```ts
ReportBuilder: {
  readonly create: (title: string) => Report;
}
```

## Examples

```ts
import { ReportBuilder } from "@savvy-web/github-action-effects"

const report = ReportBuilder.create("Build Report")
  .stat("Duration", "1.5s")
  .stat("Packages", 12)
  .section("Details", "Everything passed.")
  .toMarkdown()

```

---
id: packages/tsdown-plugins/api/function/writeissuesartifact
title: "writeIssuesArtifact — tsdown-plugins function"
summary: "Write the aggregated issues artifact to `<cwd>/dist/<target>/issues.json`. Returns the path written."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# writeIssuesArtifact

Write the aggregated issues artifact to `<cwd>/dist/<target>/issues.json`. Returns the path written.

```ts
function writeIssuesArtifact(opts: {
  cwd: string;
  target: "dev" | "prod";
  reports: ReadonlyArray<BuildReport>;
  now?: () => Date;
}): string;
```

---
id: packages/github-action-effects/api/variable/runnercontext
title: "RunnerContext — github-action-effects variable"
summary: "Runner context derived from RUNNER_* environment variables."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# RunnerContext

Runner context derived from RUNNER_* environment variables.

```ts
RunnerContext: Schema.Struct<{
  os: typeof Schema.String;
  arch: typeof Schema.String;
  name: typeof Schema.String;
  temp: typeof Schema.String;
  toolCache: typeof Schema.String;
  debug: typeof Schema.Boolean;
}>
```

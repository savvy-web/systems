---
id: packages/github-action-effects/api/variable/githubcontext
title: "GitHubContext — github-action-effects variable"
summary: "GitHub Actions context derived from GITHUB_* environment variables."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubContext

GitHub Actions context derived from GITHUB_* environment variables.

```ts
GitHubContext: Schema.Struct<{
  sha: typeof Schema.String;
  ref: typeof Schema.String;
  repository: typeof Schema.String;
  repositoryOwner: typeof Schema.String;
  workspace: typeof Schema.String;
  eventName: typeof Schema.String;
  eventPath: typeof Schema.String;
  runId: typeof Schema.String;
  runNumber: typeof Schema.String;
  actor: typeof Schema.String;
  serverUrl: typeof Schema.String;
  apiUrl: typeof Schema.String;
  graphqlUrl: typeof Schema.String;
  action: typeof Schema.String;
  job: typeof Schema.String;
  workflow: typeof Schema.String;
}>
```

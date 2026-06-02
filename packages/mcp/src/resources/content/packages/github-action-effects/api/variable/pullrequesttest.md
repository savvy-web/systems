---
id: packages/github-action-effects/api/variable/pullrequesttest
title: "PullRequestTest — github-action-effects variable"
summary: "Test implementation for PullRequest."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestTest

Test implementation for [PullRequest](silk://packages/github-action-effects/api/class/pullrequest).

```ts
PullRequestTest: {
    readonly layer: (state: PullRequestTestState) => Layer.Layer<PullRequest>;
    readonly empty: () => PullRequestTestState;
}
```

---
id: packages/github-action-effects/api/variable/gitbranchtest
title: "GitBranchTest — github-action-effects variable"
summary: "Test implementation for GitBranch."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitBranchTest

Test implementation for [GitBranch](silk://packages/github-action-effects/api/class/gitbranch).

```ts
GitBranchTest: {
  readonly layer: (state: GitBranchTestState) => Layer.Layer<GitBranch>; /** Create a fresh test state. */
  readonly empty: () => GitBranchTestState;
}
```

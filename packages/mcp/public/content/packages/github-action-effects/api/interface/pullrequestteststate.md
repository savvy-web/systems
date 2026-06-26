---
id: packages/github-action-effects/api/interface/pullrequestteststate
title: "PullRequestTestState — github-action-effects interface"
summary: "Test state for PullRequest."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestTestState

Test state for [PullRequest](silk://packages/github-action-effects/api/class/pullrequest).

```ts
interface PullRequestTestState
```

## Members

### associatedByCommit

```ts
readonly associatedByCommit: Map<string, Array<PullRequestInfo>>;
```

PRs associated with a commit SHA, returned by listAssociatedWithCommit.

### files

```ts
readonly files: Map<number, Array<PullRequestFile>>;
```

Files per PR number, returned by listFiles.

### mergedPrs

```ts
readonly mergedPrs: Array<number>;
```

### nextNumber

```ts
nextNumber: number;
```

### prs

```ts
readonly prs: Array<PullRequestRecord>;
```

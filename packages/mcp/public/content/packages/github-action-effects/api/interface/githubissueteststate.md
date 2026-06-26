---
id: packages/github-action-effects/api/interface/githubissueteststate
title: "GitHubIssueTestState — github-action-effects interface"
summary: "Test state for GitHubIssue."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubIssueTestState

Test state for [GitHubIssue](silk://packages/github-action-effects/api/class/githubissue).

```ts
interface GitHubIssueTestState
```

## Members

### closeCalls

```ts
readonly closeCalls: Array<{
    issueNumber: number;
    reason?: string;
  }>;
```

### comments

```ts
readonly comments: Array<{
    issueNumber: number;
    body: string;
  }>;
```

### issues

```ts
readonly issues: Map<number, IssueData>;
```

### linkedIssues

```ts
readonly linkedIssues: Map<number, Array<{
    number: number;
    title: string;
  }>>;
```

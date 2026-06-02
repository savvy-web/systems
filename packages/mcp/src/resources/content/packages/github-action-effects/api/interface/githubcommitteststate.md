---
id: packages/github-action-effects/api/interface/githubcommitteststate
title: "GitHubCommitTestState — github-action-effects interface"
summary: "Test state for GitHubCommit."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubCommitTestState

Test state for [GitHubCommit](silk://packages/github-action-effects/api/class/githubcommit).

```ts
interface GitHubCommitTestState
```

## Members

### commitLists

```ts
readonly commitLists: Map<string, ReadonlyArray<CommitSummary>>;
```

Commit lists by ref, returned by list.

### commits

```ts
readonly commits: Map<string, CommitDetail>;
```

Commits by ref, returned by get.

### comparisons

```ts
readonly comparisons: Map<string, CommitComparison>;
```

Comparisons keyed by `${base}...${head}`, returned by compare.
